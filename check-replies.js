/**
 * FlowReach IMAP Reply Checker
 * 
 * This script connects to your email server via IMAP, checks for replies
 * from known leads, and inserts them into the Supabase database so they
 * appear in the FlowReach Inbox.
 * 
 * Usage: node check-replies.js
 * 
 * Required: npm install imapflow @supabase/supabase-js
 * 
 * Configure the IMAP and Supabase settings below before running.
 */

const { ImapFlow } = require('imapflow');
const { createClient } = require('@supabase/supabase-js');

// ═══════════════════════════════════════════════════════════
// CONFIGURATION — Update these values
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  // IMAP Settings (check your email provider's docs)
  // For Gmail: imap.gmail.com / 993
  // For Outlook/Office365: outlook.office365.com / 993
  // For university email: ask your IT department
  imap: {
    host: process.env.IMAP_HOST || 'imap.gmail.com',  // Change this!
    port: parseInt(process.env.IMAP_PORT || '993'),
    secure: true,
    auth: {
      user: process.env.SMTP_USERNAME || 'aqib.creates@gmail.com',  // Your email
      pass: process.env.SMTP_PASSWORD || '',  // Your app password
    },
  },

  // Supabase Settings
  supabase: {
    url: 'https://zlilmhljwccilffppalp.supabase.co',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',  // Set this or use env var
  },

  // How many days back to check for emails
  daysBack: 7,
};

// ═══════════════════════════════════════════════════════════

async function main() {
  console.log('🔍 FlowReach Reply Checker');
  console.log('========================\n');

  // Validate config
  if (!CONFIG.imap.auth.pass) {
    console.error('❌ SMTP_PASSWORD not set. Set it as an environment variable or in the CONFIG above.');
    process.exit(1);
  }
  if (!CONFIG.supabase.serviceKey) {
    console.error('❌ SUPABASE_SERVICE_KEY not set. Set it as an environment variable or in the CONFIG above.');
    process.exit(1);
  }

  // Initialize Supabase
  const supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.serviceKey);

  // Get all leads
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, email, name');

  if (leadsError) {
    console.error('❌ Failed to fetch leads:', leadsError.message);
    process.exit(1);
  }

  const leadEmailMap = new Map();
  leads.forEach(lead => {
    if (lead.email) {
      leadEmailMap.set(lead.email.toLowerCase(), { id: lead.id, name: lead.name });
    }
  });

  console.log(`📋 Tracking ${leadEmailMap.size} lead email addresses\n`);

  if (leadEmailMap.size === 0) {
    console.log('No leads to check. Add leads first.');
    return;
  }

  // Connect to IMAP
  console.log(`📧 Connecting to IMAP server ${CONFIG.imap.host}:${CONFIG.imap.port}...`);
  
  const client = new ImapFlow({
    host: CONFIG.imap.host,
    port: CONFIG.imap.port,
    secure: CONFIG.imap.secure,
    auth: CONFIG.imap.auth,
    logger: false,
  });

  try {
    await client.connect();
    console.log('✅ Connected to IMAP server\n');
  } catch (err) {
    console.error(`❌ Failed to connect to IMAP: ${err.message}`);
    console.error('\nTips:');
    console.error('  - For Gmail: Use imap.gmail.com and an App Password');
    console.error('  - For Outlook: Use outlook.office365.com');
    console.error('  - Make sure IMAP is enabled in your email settings');
    process.exit(1);
  }

  // Open INBOX
  const lock = await client.getMailboxLock('INBOX');
  let newMessageCount = 0;

  try {
    const since = new Date();
    since.setDate(since.getDate() - CONFIG.daysBack);

    // Search for recent emails
    const searchResults = await client.search({ since });
    console.log(`📬 Found ${searchResults.length} emails from the last ${CONFIG.daysBack} days\n`);

    if (searchResults.length === 0) {
      console.log('No recent emails found.');
      return;
    }

    // First, fetch all existing inbound message-IDs to avoid duplicates
    // We use the subject field with a special prefix to store the email Message-ID
    const { data: existingMessages } = await supabase
      .from('messages')
      .select('metadata')
      .eq('direction', 'inbound')
      .not('metadata', 'is', null);

    const importedMessageIds = new Set();
    if (existingMessages) {
      existingMessages.forEach(msg => {
        if (msg.metadata?.email_message_id) {
        if (msg.email_message_id) importedMessageIds.add(msg.email_message_id);
      });
    }
    console.log(`📦 Already imported ${importedMessageIds.size} inbound emails\n`);

    // Fetch and process emails
    for await (const message of client.fetch(searchResults, {
      envelope: true,
      source: true,
    })) {
      const envelope = message.envelope;
      if (!envelope?.from?.length) continue;

      const senderAddress = envelope.from[0].address?.toLowerCase();
      if (!senderAddress) continue;

      // Check if this email is from a known lead
      const lead = leadEmailMap.get(senderAddress);
      if (!lead) continue;

      // Use the email's unique Message-ID for deduplication
      const emailMessageId = envelope.messageId;
      if (emailMessageId && importedMessageIds.has(emailMessageId)) {
        continue; // Already imported this exact email — skip
      }

      const subject = envelope.subject || 'Reply';
      const emailDate = envelope.date || new Date();

      // Extract text content from raw email
      let textContent = 'No text content.';
      if (message.source) {
        const rawEmail = message.source.toString();

        // Try plain text first
        const textMatch = rawEmail.match(
          /Content-Type: text\/plain[^\r\n]*\r?\n(?:Content-Transfer-Encoding:[^\r\n]*\r?\n)?(?:\r?\n)([\s\S]*?)(?:\r?\n--|\r?\n\.\r?\n|$)/i
        );
        if (textMatch) {
          textContent = textMatch[1].trim();
        } else {
          // Fallback: extract body after headers
          const bodyStart = rawEmail.indexOf('\r\n\r\n');
          if (bodyStart > 0) {
            textContent = rawEmail
              .substring(bodyStart + 4)
              .replace(/<[^>]*>?/gm, '') // Strip HTML
              .trim()
              .substring(0, 2000);
          }
        }
      }

      // Insert inbound message with the actual email date and Message-ID
      const { error: msgError } = await supabase.from('messages').insert([{
        lead_id: lead.id,
        message_type: 'email',
        direction: 'inbound',
        channel: 'email',
        content: textContent,
        subject: subject,
        status: 'received',
        created_at: emailDate.toISOString(),
        email_message_id: emailMessageId || null,
      }]);

      if (msgError) {
        console.error(`  ❌ Failed to save reply from ${lead.name}: ${msgError.message}`);
      } else {
        newMessageCount++;
        if (emailMessageId) importedMessageIds.add(emailMessageId); // Track in this run too
        console.log(`  ✅ Imported reply from ${lead.name} (${senderAddress})`);
        console.log(`     Subject: ${subject}`);
        console.log(`     Preview: ${textContent.substring(0, 80)}...\n`);
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }

  console.log('========================');
  console.log(`📊 Done! ${newMessageCount} new replies imported into FlowReach Inbox.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

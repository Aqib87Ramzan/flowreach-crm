import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { ImapFlow } from "npm:imapflow";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * check-inbox edge function
 *
 * Connects to the email server via IMAP, fetches recent emails from known leads,
 * and inserts them as inbound messages so they appear in the FlowReach Inbox.
 *
 * Uses the same SMTP credentials already configured as Supabase secrets.
 * IMAP host is auto-derived from SMTP host (smtp.gmail.com → imap.gmail.com).
 *
 * Modes:
 *  1. IMAP fetch (default POST) — connects to IMAP and pulls new replies
 *  2. Manual import (POST with {from, subject, text}) — inserts a single reply
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Try to parse body (may be empty for a plain check)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body — default to IMAP fetch
    }

    // ─── Mode 2: Manual reply import (backward compatible) ───
    if (body.from && body.text) {
      return await handleManualImport(supabase, body);
    }

    // ─── Mode 1: IMAP fetch ───
    return await handleImapFetch(supabase);

  } catch (error) {
    console.error("Check inbox error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Manual reply import — same as before for backward compatibility.
 */
async function handleManualImport(supabase: any, body: any) {
  let senderEmail = body.from;
  const emailMatch = senderEmail.match(/<([^>]+)>/);
  if (emailMatch) senderEmail = emailMatch[1];
  senderEmail = senderEmail.toLowerCase().trim();

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, name")
    .eq("email", senderEmail)
    .single();

  if (leadError || !lead) {
    return new Response(
      JSON.stringify({ success: false, error: `No lead found with email: ${senderEmail}` }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error: msgError } = await supabase.from("messages").insert([{
    lead_id: lead.id,
    message_type: "email",
    direction: "inbound",
    channel: "email",
    content: body.text,
    subject: body.subject || "Reply",
    status: "received",
  }]);

  if (msgError) throw msgError;

  return new Response(
    JSON.stringify({ success: true, message: `Reply from ${lead.name} imported`, newMessages: 1 }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * IMAP fetch — connects to mail server and pulls replies from known leads.
 */
async function handleImapFetch(supabase: any) {
  // Get IMAP credentials from env (reuse SMTP credentials)
  const SMTP_HOSTNAME = Deno.env.get("SMTP_HOSTNAME");
  const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME");
  const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");

  // Allow explicit IMAP overrides, otherwise derive from SMTP
  const IMAP_HOST = Deno.env.get("IMAP_HOST") || deriveImapHost(SMTP_HOSTNAME || "");
  const IMAP_PORT = parseInt(Deno.env.get("IMAP_PORT") || "993");

  if (!IMAP_HOST || !SMTP_USERNAME || !SMTP_PASSWORD) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "IMAP/SMTP credentials not configured. Set SMTP_HOSTNAME, SMTP_USERNAME, SMTP_PASSWORD as Supabase secrets.",
        newMessages: 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 1. Get all leads to match against
  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("id, email, name");

  if (leadsError) throw leadsError;

  const leadEmailMap = new Map<string, { id: string; name: string }>();
  leads?.forEach((lead: any) => {
    if (lead.email) {
      leadEmailMap.set(lead.email.toLowerCase(), { id: lead.id, name: lead.name });
    }
  });

  if (leadEmailMap.size === 0) {
    return new Response(
      JSON.stringify({ success: true, newMessages: 0, message: "No leads to check replies for." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2. Connect to IMAP
  console.log(`Connecting to IMAP server ${IMAP_HOST}:${IMAP_PORT}...`);

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: {
      user: SMTP_USERNAME,
      pass: SMTP_PASSWORD,
    },
    logger: false,
  });

  let newMessageCount = 0;

  try {
    await client.connect();
    console.log("Connected to IMAP server");

    const lock = await client.getMailboxLock("INBOX");

    try {
      // Search for emails from the last 7 days
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const searchResults = await client.search({ since });
      console.log(`Found ${searchResults.length} emails from the last 7 days`);

      if (searchResults.length === 0) {
        return new Response(
          JSON.stringify({ success: true, newMessages: 0, message: "No recent emails found." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Pre-fetch all existing inbound email Message-IDs to avoid duplicates
      const { data: existingMessages } = await supabase
        .from("messages")
        .select("email_message_id")
        .eq("direction", "inbound")
        .not("email_message_id", "is", null);

      const importedMessageIds = new Set<string>();
      existingMessages?.forEach((msg: any) => {
        if (msg.email_message_id) importedMessageIds.add(msg.email_message_id);
      });
      console.log(`Already have ${importedMessageIds.size} inbound emails in DB`);

      // Fetch and process emails
      for await (const message of client.fetch(searchResults, {
        envelope: true,
        source: true,
      })) {
        const envelope = message.envelope;
        if (!envelope?.from?.length) continue;

        const senderAddress = envelope.from[0].address?.toLowerCase();
        if (!senderAddress) continue;

        // Only import emails from known leads
        const lead = leadEmailMap.get(senderAddress);
        if (!lead) continue;

        // Use the email's unique Message-ID for deduplication
        const emailMessageId = envelope.messageId;
        if (emailMessageId && importedMessageIds.has(emailMessageId)) {
          continue; // Already imported — skip
        }

        const subject = envelope.subject || "Reply";
        const emailDate = envelope.date || new Date();

        // Extract text content from raw email
        let textContent = "No text content.";
        if (message.source) {
          const rawEmail = message.source.toString();
          textContent = extractTextFromEmail(rawEmail);
        }

        // Insert inbound message with email_message_id for future dedup
        const { error: msgError } = await supabase.from("messages").insert([{
          lead_id: lead.id,
          message_type: "email",
          direction: "inbound",
          channel: "email",
          content: textContent,
          subject: subject,
          status: "received",
          email_message_id: emailMessageId || null,
          created_at: emailDate.toISOString(),
        }]);

        if (msgError) {
          console.error(`Failed to save reply from ${lead.name}: ${msgError.message}`);
        } else {
          newMessageCount++;
          if (emailMessageId) importedMessageIds.add(emailMessageId); // Track within this run too
          console.log(`Imported reply from ${lead.name} (${senderAddress}): ${subject}`);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (imapError) {
    console.error("IMAP connection error:", imapError);
    const errMsg = imapError instanceof Error ? imapError.message : "IMAP connection failed";

    return new Response(
      JSON.stringify({
        success: false,
        error: `IMAP error: ${errMsg}`,
        details: {
          imapHost: IMAP_HOST,
          imapPort: IMAP_PORT,
          username: SMTP_USERNAME,
          hint: "Check that IMAP_HOST is correct for your email provider, and that IMAP access is enabled. For Office 365 / university accounts, the IMAP host is usually outlook.office365.com.",
        },
        newMessages: 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`Done! ${newMessageCount} new replies imported.`);

  return new Response(
    JSON.stringify({
      success: true,
      newMessages: newMessageCount,
      message: newMessageCount > 0
        ? `${newMessageCount} new replies imported into inbox.`
        : "No new replies found.",
      debug: { imapHost: IMAP_HOST, imapPort: IMAP_PORT },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Derive IMAP host from SMTP host.
 * e.g. smtp.gmail.com → imap.gmail.com
 */
function deriveImapHost(smtpHost: string): string {
  if (!smtpHost) return "";

  // Common mappings
  const mappings: Record<string, string> = {
    "smtp.gmail.com": "imap.gmail.com",
    "smtp.office365.com": "outlook.office365.com",
    "smtp.mail.yahoo.com": "imap.mail.yahoo.com",
    "smtp.outlook.com": "outlook.office365.com",
    // University / institutional servers (NUST SEECS uses Office 365)
    "smtp.seecs.edu.pk": "outlook.office365.com",
    "mail.seecs.edu.pk": "outlook.office365.com",
  };

  const lower = smtpHost.toLowerCase();
  if (mappings[lower]) return mappings[lower];

  // Generic: replace "smtp" with "imap"
  return lower.replace(/^smtp\./, "imap.");
}

/**
 * Extract plain text content from a raw email.
 */
function extractTextFromEmail(rawEmail: string): string {
  // Try to find plain text part
  const textMatch = rawEmail.match(
    /Content-Type: text\/plain[^\r\n]*\r?\n(?:Content-Transfer-Encoding:[^\r\n]*\r?\n)?(?:\r?\n)([\s\S]*?)(?:\r?\n--|boundary|$)/i
  );

  if (textMatch) {
    return decodeEmailContent(textMatch[1].trim()).substring(0, 5000);
  }

  // Fallback: extract body after headers, strip HTML
  const bodyStart = rawEmail.indexOf("\r\n\r\n");
  if (bodyStart > 0) {
    const body = rawEmail.substring(bodyStart + 4);
    return body
      .replace(/<[^>]*>?/gm, "") // Strip HTML tags
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .trim()
      .substring(0, 5000);
  }

  return "No text content.";
}

/**
 * Decode base64 or quoted-printable encoded content.
 */
function decodeEmailContent(content: string): string {
  // Check for base64 encoded content
  if (/^[A-Za-z0-9+/\r\n]+=*\s*$/.test(content.trim())) {
    try {
      return atob(content.replace(/\r?\n/g, ""));
    } catch {
      // Not valid base64, return as-is
    }
  }

  // Decode quoted-printable soft line breaks
  return content
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_match, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

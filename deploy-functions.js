#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

// Get environment variables
const projectId = process.env.VITE_SUPABASE_PROJECT_ID || 'ndmhlljjnvfzvvqidgkh';
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ndmhlljjnvfzvvqidgkh.supabase.co';

// Try to get service role key from environment
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not found');
  console.log('\nTo deploy functions, you need to set the service role key:');
  console.log('1. Go to Supabase Dashboard: https://app.supabase.com');
  console.log('2. Select your project: ' + projectId);
  console.log('3. Go to Settings > API > Service Role Key');
  console.log('4. Copy the key and set it as an environment variable:\n');
  console.log('   Windows (PowerShell):');
  console.log('   $env:SUPABASE_SERVICE_ROLE_KEY="your-key-here"');
  console.log('\n   Windows (CMD):');
  console.log('   set SUPABASE_SERVICE_ROLE_KEY=your-key-here\n');
  console.log('5. Then run this script again');
  process.exit(1);
}

console.log('🚀 Deploying Supabase functions...');
console.log(`Project ID: ${projectId}`);
console.log(`URL: ${supabaseUrl}\n`);

// Read the webhook-lead function
const webhookLeadPath = path.join(__dirname, 'supabase', 'functions', 'webhook-lead', 'index.ts');

if (!fs.existsSync(webhookLeadPath)) {
  console.error('❌ Error: webhook-lead function not found at', webhookLeadPath);
  process.exit(1);
}

const webhookLeadCode = fs.readFileSync(webhookLeadPath, 'utf8');

console.log('✅ Read webhook-lead function');

// Deploy via Supabase API
const deployFunction = async (functionName, code) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${supabaseUrl}/functions/v1/${functionName}`);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/typescript',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, statusCode: res.statusCode });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(code);
    req.end();
  });
};

deployFunction('webhook-lead', webhookLeadCode)
  .then(() => {
    console.log('✅ webhook-lead function deployed successfully\n');
    console.log('🎉 All functions deployed!\n');
    console.log('Next steps:');
    console.log('1. Test the webhook with a new lead POST request');
    console.log('2. Check your inbox to verify the SMS workflow executes automatically');
  })
  .catch((error) => {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  });

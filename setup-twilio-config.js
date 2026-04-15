#!/usr/bin/env node

const https = require('https');

// Get Twilio credentials from environment or user input
const PROJECT_ID = 'ndmhlljjnvfzvvqidgkh';

// These should be set as environment variables, not hardcoded!
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE) {
  console.error('❌ Error: Twilio environment variables not set\n');
  console.log('Set these environment variables before running this script:');
  console.log('PowerShell:');
  console.log('  $env:TWILIO_ACCOUNT_SID = "your-account-sid"');
  console.log('  $env:TWILIO_AUTH_TOKEN = "your-auth-token"');
  console.log('  $env:TWILIO_PHONE = "your-twilio-phone"');
  console.log('\nThen run: node setup-twilio-config.js');
  process.exit(1);
}

console.log('🔧 Configuring Twilio credentials for Supabase...\n');
console.log('Project ID:', PROJECT_ID);
console.log('Twilio Phone:', TWILIO_PHONE);

// Store instructions in a file
const fs = require('fs');
const configPath = './TWILIO_SETUP_INSTRUCTIONS.md';

const instructions = `# Twilio Configuration for Supabase

## Environment Variables to Add

Add these secrets to your Supabase Edge Functions:

1. Go to: https://app.supabase.com/project/ndmhlljjnvfzvvqidgkh/settings/functions
2. Click on "Secrets" tab
3. Add these environment variables:

| Variable Name | Value | Description |
|---|---|---|
| TWILIO_ACCOUNT_SID | [Your Account SID from Twilio] | Your Twilio account identifier |
| TWILIO_AUTH_TOKEN | [Your Auth Token from Twilio] | Your Twilio authentication token |
| TWILIO_PHONE | [Your Twilio Phone Number] | The phone number to send SMS from |

## How to Get These Credentials

1. Go to https://www.twilio.com/console
2. Find your Account SID and Auth Token in the dashboard
3. Find your Twilio phone number in the "Phone Numbers" section

## Verification

After adding the secrets:
1. Test the webhook with a new lead POST request
2. Check your Inbox - SMS should be sent automatically to the lead's phone
3. Verify the message appears in the SMS History table

## Troubleshooting

If SMS not sending:
- Check Supabase function logs for errors
- Verify phone number format (should include country code, e.g., +923285082387)
- Ensure Twilio account has credits
- Check that TWILIO_PHONE matches a phone number in your Twilio account

---
Last configured: ${new Date().toISOString()}
`;

fs.writeFileSync(configPath, instructions);

console.log('\n✅ Setup instructions created: TWILIO_SETUP_INSTRUCTIONS.md');
console.log('\n📋 Next Steps:');
console.log('1. Go to: https://app.supabase.com/project/ndmhlljjnvfzvvqidgkh/settings/functions');
console.log('2. Click "Secrets" tab');
console.log('3. Add these environment variables:');
console.log('   - TWILIO_ACCOUNT_SID: (your account SID)');
console.log('   - TWILIO_AUTH_TOKEN: (your auth token)');
console.log('   - TWILIO_PHONE: (your Twilio phone number)');
console.log('\n4. Save and wait for deployment');
console.log('\n✨ SMS will then be automatically sent when leads arrive!\n');

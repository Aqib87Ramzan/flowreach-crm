# Supabase Environment Configuration

## For Local Development

Add this file at `supabase/.env.local` for local development:

```env
SUPABASE_URL=https://ndmhlljjnvfzvvqidgkh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE=your_twilio_phone_number_here
```

Note: `.env.local` is ignored by Git for security. Only you need this locally.

## For Deployed Supabase (Production)

These variables need to be configured in your Supabase project:

1. Go to: https://supabase.com/dashboard/project/ndmhlljjnvfzvvqidgkh/settings/api

2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** secret key → `SUPABASE_SERVICE_ROLE_KEY`

3. Go to: https://supabase.com/dashboard/project/ndmhlljjnvfzvvqidgkh/functions/manage/secrets

4. Add these secrets:
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = your service role key
   - `TWILIO_ACCOUNT_SID` = your Twilio SID
   - `TWILIO_AUTH_TOKEN` = your Twilio token
   - `TWILIO_PHONE` = your Twilio phone number

## Getting Your Credentials

### Supabase
1. Go to https://supabase.com/dashboard
2. Open your project
3. Settings > API > Copy Project URL and service_role key

### Twilio
1. Go to https://www.twilio.com/console
2. Find your Account SID and Auth Token
3. In Phone Numbers section, find your Twilio phone number

## Testing

After configuring, test the SMS workflow:

1. Send a POST request with lead data to your webhook
2. Lead should appear in Inbox
3. SMS should be automatically sent to the lead's phone
4. Message record created in the database

## Verification

To verify Twilio is working:
- Check Supabase function logs for SMS sending
- Check Twilio console for outgoing messages
- Verify message status in your Inbox table

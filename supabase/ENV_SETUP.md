# Supabase Environment Configuration

Add this file at `supabase/.env.local` for local development:

```env
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE=your_twilio_phone_number_here
```

Note: `.env.local` is ignored by Git for security. Only you need this locally.

## Getting Your Twilio Credentials

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

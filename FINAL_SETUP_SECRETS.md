# Final Setup - Add Secrets to Supabase Functions

Your new Supabase project is ready! Now add these 5 secrets so SMS and WhatsApp will work.

## Step 1: Go to Secrets Management

1. Open: https://supabase.com/dashboard/project/yhnjmrsqykdqxojuyowt/functions/manage/secrets

2. Click **+ New Secret** and add each secret below

## Secrets to Add

### Secret 1: SUPABASE_URL
```
Name: SUPABASE_URL
Value: https://yhnjmrsqykdqxojuyowt.supabase.co
```

### Secret 2: SUPABASE_SERVICE_ROLE_KEY
```
Name: SUPABASE_SERVICE_ROLE_KEY
Value: (paste the secret key from Settings > API - starts with sb_secret_)
```

### Secret 3: TWILIO_ACCOUNT_SID
```
Name: TWILIO_ACCOUNT_SID
Value: (from your .env file - AC...)
```

### Secret 4: TWILIO_AUTH_TOKEN
```
Name: TWILIO_AUTH_TOKEN
Value: (from your .env file)
```

### Secret 5: TWILIO_PHONE
```
Name: TWILIO_PHONE
Value: (from your .env file - +92...)
```

## Step 2: Verify Everything Works

After adding all 5 secrets:

1. Test sending SMS in your app
2. Check if messages appear with "sent" status
3. Verify SMS appears in Twilio console

## Troubleshooting

If SMS shows "pending" status:
- Go back and make sure all 5 secrets are added
- Secret names must match EXACTLY (case-sensitive)

If you get 500 error:
- Check the Supabase function logs at:
  https://supabase.com/dashboard/project/yhnjmrsqykdqxojuyowt/functions

## All Set! 🎉

Your app should now:
✅ Capture leads
✅ Save them in Supabase
✅ Send SMS via Twilio
✅ Show messages in Inbox

Questions? Check the logs!

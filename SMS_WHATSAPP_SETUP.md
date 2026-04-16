# Complete Setup Guide - SMS & WhatsApp Sending

Your app is now working! Leads are being captured and appearing in the Inbox. But to actually **send SMS and WhatsApp messages**, you need to configure environment variables in Supabase.

## Status Check

✅ Webhook working - Leads appearing in inbox  
❌ SMS not sending - Twilio credentials missing in Supabase  
❌ WhatsApp not sending - WhatsApp credentials missing in Supabase

## How to Fix It

### Step 1: Get Your Service Role Key

1. Go to: https://supabase.com/dashboard/project/ndmhlljjnvfzvvqidgkh/settings/api
2. Scroll down to **Project API Keys**
3. Find **service_role** (the secret key, not the public key)
4. Copy it (it's a long JWT starting with `eyJ...`)

### Step 2: Configure Secrets in Supabase

Go to: https://supabase.com/dashboard/project/ndmhlljjnvfzvvqidgkh/functions/manage/secrets

Click **+ New Secret** and add EXACTLY these 5 secrets:

#### Secret 1: SUPABASE_URL
```
Name: SUPABASE_URL
Value: https://ndmhlljjnvfzvvqidgkh.supabase.co
```

#### Secret 2: SUPABASE_SERVICE_ROLE_KEY
```
Name: SUPABASE_SERVICE_ROLE_KEY
Value: (paste the service_role key from Step 1)
```

#### Secret 3: TWILIO_ACCOUNT_SID
```
Name: TWILIO_ACCOUNT_SID
Value: (copy from your .env file, starts with AC...)
```

#### Secret 4: TWILIO_AUTH_TOKEN
```
Name: TWILIO_AUTH_TOKEN
Value: (copy from your .env file)
```

#### Secret 5: TWILIO_PHONE
```
Name: TWILIO_PHONE
Value: (copy from your .env file, e.g., +92...)
```

### Step 3: (Optional) Configure WhatsApp

If you want WhatsApp working, add these 2 secrets:

```
Name: WHATSAPP_API_TOKEN
Value: (your WhatsApp Business API token from Meta/Facebook)

Name: WHATSAPP_PHONE_NUMBER_ID
Value: (your WhatsApp Business phone number ID)
```

### Step 4: Test SMS Sending

After adding the secrets, try sending an SMS in your app:

1. Go to: http://localhost:8080/send-sms
2. Select a lead (like "Aqib Ramzan Lead")
3. Type a message
4. Click "Send SMS"

**Expected results:**
- ✅ Message appears in Inbox with status "sent"
- ✅ Twilio sends the actual SMS to the phone number
- ✅ SMS History shows the message

### Troubleshooting

**Problem:** SMS shows "pending" status
- **Cause:** Twilio credentials not configured in Supabase secrets
- **Fix:** Make sure you added all 5 secrets above

**Problem:** Function returns 500 error
- **Cause:** Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY
- **Fix:** Double-check those 2 secrets are correct

**Problem:** SMS shows "failed" status
- **Cause:** Twilio API error (wrong SID, token, or phone number)
- **Fix:** Verify credentials in your `.env` file match what's in Supabase

**To debug:** Check Supabase function logs at:
https://supabase.com/dashboard/project/ndmhlljjnvfzvvqidgkh/functions

## Next Steps

1. ✅ Add all 5 secrets to Supabase
2. ✅ Test SMS sending
3. ✅ Optional: Configure WhatsApp
4. ✅ Done!

Questions? Check the logs in Supabase dashboard!

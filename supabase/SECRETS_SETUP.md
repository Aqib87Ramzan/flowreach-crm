# Supabase Secrets Configuration Guide

After pushing to GitHub and deploying through Lovable, you need to manually set the environment variables in your Supabase project.

## Step 1: Get Your Service Role Key

1. Go to: https://supabase.com/dashboard/project/ndmhlljjnvfzvvqidgkh/settings/api
2. Under **Project API Keys**, copy the **service_role** secret (the long JWT token starting with `eyJ...`)
3. Keep this safe!

## Step 2: Add Secrets to Edge Functions

1. Go to: https://supabase.com/dashboard/project/ndmhlljjnvfzvvqidgkh/functions/manage/secrets
2. Click **+ New Secret** for each of these:

### Required Secrets

```
Name: SUPABASE_URL
Value: https://ndmhlljjnvfzvvqidgkh.supabase.co

Name: SUPABASE_SERVICE_ROLE_KEY
Value: (paste the service_role key from Step 1)

Name: TWILIO_ACCOUNT_SID
Value: (copy from your .env file - AC...)

Name: TWILIO_AUTH_TOKEN
Value: (copy from your .env file)

Name: TWILIO_PHONE
Value: (copy from your .env file - +92...)
```

### Optional Secrets (for WhatsApp)

```
Name: WHATSAPP_API_TOKEN
Value: (your WhatsApp API token, if you have one)

Name: WHATSAPP_PHONE_NUMBER_ID
Value: (your WhatsApp Business phone number ID, if you have one)
```

## Step 3: Verify Setup

After adding the secrets, test your functions:

**Test send-whatsapp function:**
```bash
curl -X POST https://ndmhlljjnvfzvvqidgkh.supabase.co/functions/v1/send-whatsapp \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+923285082387",
    "message": "Test message",
    "lead_id": "550e8400-e29b-41d4-a716-446655440000",
    "execution_id": null
  }'
```

**Expected response:**
```json
{
  "success": true,
  "message": "WhatsApp message processed",
  "data": {
    "id": "uuid",
    "status": "pending"
  }
}
```

## Troubleshooting

If you get `500 Internal Server Error`:
- Check that all required secrets are set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- Verify the service_role key is correct (check the dashboard)
- Check the function logs in Supabase dashboard

If you get `Invalid input syntax for type uuid`:
- Make sure the `lead_id` exists in your leads table
- Check that test leads were created (migrations ran successfully)

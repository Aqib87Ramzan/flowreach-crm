# Supabase Environment Configuration

## SMTP Email Secrets (Required)

Set these secrets in your Supabase project for the `send-email` edge function to work:

```bash
npx supabase secrets set SMTP_HOSTNAME=smtp.gmail.com
npx supabase secrets set SMTP_PORT=587
npx supabase secrets set SMTP_USERNAME=your_email@gmail.com
npx supabase secrets set SMTP_PASSWORD=your_app_password_here
npx supabase secrets set SMTP_FROM_EMAIL=your_email@gmail.com
```

> **Gmail users:** Use an App Password (https://myaccount.google.com/apppasswords), NOT your regular password.

## IMAP Reply Syncing (Auto-configured)

The `check-inbox` edge function automatically derives the IMAP host from your SMTP host:
- `smtp.gmail.com` → `imap.gmail.com`
- `smtp.office365.com` → `outlook.office365.com`

It reuses `SMTP_USERNAME` and `SMTP_PASSWORD` for IMAP authentication.

If your IMAP server is different, set these optional overrides:

```bash
npx supabase secrets set IMAP_HOST=imap.gmail.com
npx supabase secrets set IMAP_PORT=993
```

> **Gmail users:** Make sure IMAP is enabled in your Gmail settings:
> Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP

## Deploy Edge Functions

```bash
npx supabase functions deploy send-email --project-ref zlilmhljwccilffppalp
npx supabase functions deploy check-inbox --project-ref zlilmhljwccilffppalp
npx supabase functions deploy webhook-lead --project-ref zlilmhljwccilffppalp
npx supabase functions deploy webhook-email-inbound --project-ref zlilmhljwccilffppalp
npx supabase functions deploy execute-workflow --project-ref zlilmhljwccilffppalp
```

## Testing

After configuring, test the email workflow:

1. Send a POST request with lead data to your webhook URL
2. Lead should appear in the Leads page
3. Email should be automatically sent to the lead's email
4. Message record created in the Inbox
5. When the lead replies, click "Check Replies" in Inbox or wait 60s for auto-sync

-- =====================================================
-- FlowReach: Auto Reply Checking for Production
-- =====================================================
-- This migration does 2 things:
--   1. Adds email_message_id column to messages table
--      so we can track which IMAP emails we already imported
--      (prevents duplicate imports)
--   2. Sets up a pg_cron job to automatically call the
--      check-inbox edge function every 5 minutes
-- =====================================================

-- 1. Add email_message_id column for deduplication
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS email_message_id TEXT;

-- Create a unique index so the same email can never be imported twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_email_message_id
  ON public.messages (email_message_id)
  WHERE email_message_id IS NOT NULL;

-- Index for faster lookups during dedup check
CREATE INDEX IF NOT EXISTS idx_messages_direction_email_id
  ON public.messages (direction, email_message_id)
  WHERE direction = 'inbound';

-- 2. Set up pg_cron to auto-check for replies every 5 minutes
-- NOTE: pg_cron must be enabled in your Supabase project:
--   Dashboard → Database → Extensions → search "pg_cron" → Enable

-- Enable the extension (safe to call even if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Remove old job if it exists (prevents duplicates on re-run)
SELECT cron.unschedule('check-inbox-replies')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-inbox-replies'
);

-- Schedule the check-inbox edge function to run every 5 minutes
-- This calls your deployed Supabase Edge Function via HTTP
SELECT cron.schedule(
  'check-inbox-replies',          -- job name
  '*/5 * * * *',                  -- every 5 minutes
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/check-inbox',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

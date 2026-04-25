ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS email_message_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_email_message_id ON public.messages (email_message_id) WHERE email_message_id IS NOT NULL;

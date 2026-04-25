-- Check how many duplicate inbound messages exist (no email_message_id)
SELECT id, lead_id, subject, direction, created_at, email_message_id 
FROM public.messages 
WHERE direction = 'inbound' 
ORDER BY created_at DESC 
LIMIT 20;

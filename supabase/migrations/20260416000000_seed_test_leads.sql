-- Add seed data for testing
-- This migration runs after all table creation migrations

INSERT INTO public.leads (
  id,
  user_id,
  name,
  email,
  phone,
  source,
  status,
  notes
) VALUES 
  (
    '550e8400-e29b-41d4-a716-446655440000'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'Test Lead',
    'test@example.com',
    '+923285082387',
    'test',
    'new',
    'Test lead for WhatsApp, SMS, and Email testing'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440002'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'Ahmed Raza',
    'ahmed@example.com',
    '+923001234567',
    'facebook',
    'new',
    'Interested in premium plan'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440003'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'Fatima Khan',
    'fatima@example.com',
    '+923219876543',
    'instagram',
    'contacted',
    'Follow up next week'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440004'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'Ali Hassan',
    'ali@example.com',
    '+923334567890',
    'website',
    'replied',
    'Requested demo'
  )
ON CONFLICT (id) DO NOTHING;

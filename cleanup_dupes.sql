-- Delete all duplicate inbound messages except the most recent one per lead+subject combo
DELETE FROM public.messages
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY lead_id, direction, subject 
      ORDER BY created_at DESC
    ) as rn
    FROM public.messages
    WHERE direction = 'inbound'
  ) ranked
  WHERE rn > 1
);

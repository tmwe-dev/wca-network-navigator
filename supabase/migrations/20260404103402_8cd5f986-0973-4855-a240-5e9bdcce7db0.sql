-- Delete duplicate WhatsApp messages keeping the oldest
DELETE FROM channel_messages
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY channel, from_address, to_address, body_text
      ORDER BY created_at ASC
    ) as rn
    FROM channel_messages
    WHERE channel IN ('whatsapp', 'linkedin')
  ) ranked
  WHERE rn > 1
);

-- Also delete the duplicate "indi 💃" vs "indie 💃" — normalize sidebar names
-- Fix: keep newest for contacts with near-identical names (manual cleanup)

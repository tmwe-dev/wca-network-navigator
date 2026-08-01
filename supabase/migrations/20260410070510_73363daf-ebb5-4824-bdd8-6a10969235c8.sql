-- BF-007: Add idempotency_key for retry safety
ALTER TABLE public.email_campaign_queue 
ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE;

-- Backfill existing rows with unique keys
UPDATE public.email_campaign_queue 
SET idempotency_key = gen_random_uuid()::text 
WHERE idempotency_key IS NULL;

-- Make it non-null with default for future rows
ALTER TABLE public.email_campaign_queue 
ALTER COLUMN idempotency_key SET DEFAULT gen_random_uuid()::text;

ALTER TABLE public.email_campaign_queue 
ALTER COLUMN idempotency_key SET NOT NULL;
-- LOVABLE-SH1: idempotency atomica per send-email
-- Sostituisce il vincolo UNIQUE su (idempotency_key) con UNIQUE su (idempotency_key, recipient_email)
-- per permettere INSERT ... ON CONFLICT atomico ed evitare race condition sui retry concorrenti.

DO $$
BEGIN
  -- Drop precedente UNIQUE su sola key (conflitto con uso multi-recipient con stessa key)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_campaign_queue_idempotency_key_key'
      AND conrelid = 'public.email_campaign_queue'::regclass
  ) THEN
    ALTER TABLE public.email_campaign_queue
      DROP CONSTRAINT email_campaign_queue_idempotency_key_key;
  END IF;

  -- Aggiungi UNIQUE composito (key, recipient) se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_campaign_queue_idempotency_recipient_uniq'
      AND conrelid = 'public.email_campaign_queue'::regclass
  ) THEN
    ALTER TABLE public.email_campaign_queue
      ADD CONSTRAINT email_campaign_queue_idempotency_recipient_uniq
      UNIQUE (idempotency_key, recipient_email);
  END IF;
END $$;
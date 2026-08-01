-- Coda di revisione anti-prompt-injection
CREATE TABLE IF NOT EXISTS public.prompt_injection_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source TEXT NOT NULL,
  function_name TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  content_preview TEXT NOT NULL,
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  highest_severity TEXT NOT NULL DEFAULT 'high',
  status TEXT NOT NULL DEFAULT 'pending',
  decision_reason TEXT,
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prompt_injection_reviews_status_chk
    CHECK (status IN ('pending','approved','rejected','expired'))
);

CREATE INDEX IF NOT EXISTS idx_pir_user_status
  ON public.prompt_injection_reviews(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pir_hash
  ON public.prompt_injection_reviews(user_id, content_hash, status);
CREATE INDEX IF NOT EXISTS idx_pir_created
  ON public.prompt_injection_reviews(created_at DESC);

ALTER TABLE public.prompt_injection_reviews ENABLE ROW LEVEL SECURITY;

-- updated_at trigger (riusa funzione esistente se c'è, altrimenti inline)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_pir'
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at_pir()
    RETURNS TRIGGER LANGUAGE plpgsql
    SECURITY DEFINER SET search_path = public AS $f$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $f$;
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_pir_updated_at ON public.prompt_injection_reviews;
CREATE TRIGGER trg_pir_updated_at
  BEFORE UPDATE ON public.prompt_injection_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_pir();

-- RLS: utente vede solo le proprie review
CREATE POLICY "pir_select_own"
  ON public.prompt_injection_reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "pir_insert_own"
  ON public.prompt_injection_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "pir_update_own"
  ON public.prompt_injection_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
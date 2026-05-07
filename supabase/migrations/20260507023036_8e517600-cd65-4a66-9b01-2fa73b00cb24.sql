-- Brand Voice telemetry: tracks adherence score per produced/sent message
CREATE TABLE IF NOT EXISTS public.brand_voice_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  partner_id uuid,
  channel text NOT NULL,
  journalist_role text,
  brand_voice_score integer NOT NULL CHECK (brand_voice_score >= 0 AND brand_voice_score <= 100),
  deviations jsonb NOT NULL DEFAULT '[]'::jsonb,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_excerpt text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_voice_audits_created ON public.brand_voice_audits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brand_voice_audits_channel ON public.brand_voice_audits(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brand_voice_audits_role ON public.brand_voice_audits(journalist_role, created_at DESC);

ALTER TABLE public.brand_voice_audits ENABLE ROW LEVEL SECURITY;

-- Visibility: ogni operatore autenticato vede tutto (coerente con global agent visibility)
CREATE POLICY "brand_voice_audits_select_authenticated"
  ON public.brand_voice_audits
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert: solo service role o utenti autenticati che inseriscono il proprio audit
CREATE POLICY "brand_voice_audits_insert_authenticated"
  ON public.brand_voice_audits
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

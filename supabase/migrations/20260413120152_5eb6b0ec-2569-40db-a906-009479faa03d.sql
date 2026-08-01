CREATE TABLE IF NOT EXISTS public.ab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  test_name text NOT NULL,
  test_type text NOT NULL DEFAULT 'subject',
  status text NOT NULL DEFAULT 'running',
  variant_a jsonb NOT NULL DEFAULT '{}',
  variant_b jsonb NOT NULL DEFAULT '{}',
  total_sent_a integer DEFAULT 0,
  total_sent_b integer DEFAULT 0,
  responses_a integer DEFAULT 0,
  responses_b integer DEFAULT 0,
  open_rate_a numeric(5,2) DEFAULT 0,
  open_rate_b numeric(5,2) DEFAULT 0,
  winner text,
  confidence_level numeric(5,2) DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ab_tests"
  ON public.ab_tests FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS ab_test_id uuid REFERENCES public.ab_tests(id);
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS ab_variant text;
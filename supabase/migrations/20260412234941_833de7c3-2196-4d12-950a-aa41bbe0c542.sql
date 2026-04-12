CREATE TABLE public.ai_edit_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email_type TEXT,
  country_code TEXT,
  channel TEXT DEFAULT 'email',
  hook_original TEXT,
  hook_final TEXT,
  cta_original TEXT,
  cta_final TEXT,
  tone_delta TEXT,
  length_delta_percent INTEGER,
  formality_shift TEXT,
  persuasion_pattern TEXT,
  significance TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_edit_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own patterns"
  ON public.ai_edit_patterns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patterns"
  ON public.ai_edit_patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ai_edit_patterns_user
  ON public.ai_edit_patterns(user_id, email_type, country_code);
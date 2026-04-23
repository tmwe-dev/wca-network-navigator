ALTER TABLE public.email_address_rules
  ADD COLUMN IF NOT EXISTS custom_prompt TEXT,
  ADD COLUMN IF NOT EXISTS applied_rules JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS prompt_template_id TEXT;

CREATE TABLE IF NOT EXISTS public.prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'commercial', 'support', 'newsletter', 'spam')),
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select templates" ON public.prompt_templates;
CREATE POLICY "Users can select templates"
  ON public.prompt_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_system = true);

DROP POLICY IF EXISTS "Users manage own templates" ON public.prompt_templates;
CREATE POLICY "Users manage own templates"
  ON public.prompt_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own templates" ON public.prompt_templates;
CREATE POLICY "Users update own templates"
  ON public.prompt_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_system = false)
  WITH CHECK (auth.uid() = user_id AND is_system = false);

DROP POLICY IF EXISTS "Users delete own templates" ON public.prompt_templates;
CREATE POLICY "Users delete own templates"
  ON public.prompt_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_system = false);

DROP TRIGGER IF EXISTS update_prompt_templates_updated_at ON public.prompt_templates;
CREATE TRIGGER update_prompt_templates_updated_at
  BEFORE UPDATE ON public.prompt_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_prompt_templates_user_category
  ON public.prompt_templates (user_id, category);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_is_system
  ON public.prompt_templates (is_system) WHERE is_system = true;

CREATE INDEX IF NOT EXISTS idx_email_address_rules_custom_prompt
  ON public.email_address_rules (operator_id) WHERE custom_prompt IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_address_rules_prompt_template_id
  ON public.email_address_rules (prompt_template_id);
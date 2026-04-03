-- 1. Add category column to channel_messages
ALTER TABLE public.channel_messages
  ADD COLUMN IF NOT EXISTS category text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_channel_messages_category
  ON public.channel_messages (category) WHERE category IS NOT NULL;

-- 2. Create email_prompts table
CREATE TABLE public.email_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'address',
  scope_value text,
  title text NOT NULL,
  instructions text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_scope CHECK (scope IN ('address', 'category', 'global'))
);

ALTER TABLE public.email_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own email_prompts"
  ON public.email_prompts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_email_prompts_updated_at
  BEFORE UPDATE ON public.email_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create email_address_rules table
CREATE TABLE public.email_address_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_address text NOT NULL,
  display_name text,
  category text,
  prompt_id uuid REFERENCES public.email_prompts(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email_address)
);

ALTER TABLE public.email_address_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own email_address_rules"
  ON public.email_address_rules FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_email_address_rules_updated_at
  BEFORE UPDATE ON public.email_address_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_email_address_rules_address
  ON public.email_address_rules (user_id, email_address);
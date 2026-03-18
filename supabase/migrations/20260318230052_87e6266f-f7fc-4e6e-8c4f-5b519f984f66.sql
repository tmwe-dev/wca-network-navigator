
-- AI Memory: persistent memory for the AI assistant
CREATE TABLE public.ai_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  memory_type text NOT NULL DEFAULT 'fact',
  content text NOT NULL,
  tags text[] DEFAULT '{}',
  context_page text,
  importance integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ai_memory" ON public.ai_memory
  FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ai_memory_user_tags ON public.ai_memory USING gin (tags);
CREATE INDEX idx_ai_memory_user_id ON public.ai_memory (user_id, created_at DESC);

-- AI Work Plans: multi-step job plans
CREATE TABLE public.ai_work_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  steps jsonb NOT NULL DEFAULT '[]',
  current_step integer NOT NULL DEFAULT 0,
  tags text[] DEFAULT '{}',
  source_template_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'
);

ALTER TABLE public.ai_work_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ai_work_plans" ON public.ai_work_plans
  FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ai_work_plans_user_status ON public.ai_work_plans (user_id, status);
CREATE INDEX idx_ai_work_plans_tags ON public.ai_work_plans USING gin (tags);

-- AI Plan Templates: reusable plan blueprints
CREATE TABLE public.ai_plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  steps_template jsonb NOT NULL DEFAULT '[]',
  tags text[] DEFAULT '{}',
  use_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_plan_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ai_plan_templates" ON public.ai_plan_templates
  FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ai_plan_templates_user ON public.ai_plan_templates (user_id);
CREATE INDEX idx_ai_plan_templates_tags ON public.ai_plan_templates USING gin (tags);

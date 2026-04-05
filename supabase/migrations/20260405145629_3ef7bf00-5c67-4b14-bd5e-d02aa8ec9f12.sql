
-- KB Entries: atomic knowledge base cards
CREATE TABLE public.kb_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'generale',
  chapter TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 5,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kb_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own kb_entries"
  ON public.kb_entries FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_kb_entries_category ON public.kb_entries (user_id, category);
CREATE INDEX idx_kb_entries_tags ON public.kb_entries USING GIN (tags);

CREATE TRIGGER update_kb_entries_updated_at
  BEFORE UPDATE ON public.kb_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Operative Prompts: structured prompt objects
CREATE TABLE public.operative_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT 'general',
  objective TEXT NOT NULL DEFAULT '',
  procedure TEXT NOT NULL DEFAULT '',
  criteria TEXT NOT NULL DEFAULT '',
  examples TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.operative_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own operative_prompts"
  ON public.operative_prompts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_operative_prompts_context ON public.operative_prompts (user_id, context);
CREATE INDEX idx_operative_prompts_tags ON public.operative_prompts USING GIN (tags);

CREATE TRIGGER update_operative_prompts_updated_at
  BEFORE UPDATE ON public.operative_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

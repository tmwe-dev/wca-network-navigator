
-- Proposte di modifica prompt (output Co-pilot Chat del Prompt Reader)
CREATE TABLE public.prompt_change_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL,
  prompt_table TEXT NOT NULL DEFAULT 'operative_prompts',
  block_name TEXT NOT NULL,
  source_tool TEXT NOT NULL DEFAULT 'prompt-reader-copilot',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','applied')),
  current_content TEXT,
  proposed_content TEXT NOT NULL,
  diff_text TEXT,
  rationale TEXT,
  risks TEXT,
  assumptions TEXT,
  kb_entries_consulted UUID[] DEFAULT '{}'::UUID[],
  created_by UUID NOT NULL DEFAULT auth.uid(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_prompt_change_proposals_prompt ON public.prompt_change_proposals(prompt_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_prompt_change_proposals_status ON public.prompt_change_proposals(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_prompt_change_proposals_created_by ON public.prompt_change_proposals(created_by);

ALTER TABLE public.prompt_change_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_prompt_change_proposals" ON public.prompt_change_proposals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_prompt_change_proposals" ON public.prompt_change_proposals
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "owner_update_prompt_change_proposals" ON public.prompt_change_proposals
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_prompt_change_proposals_updated
  BEFORE UPDATE ON public.prompt_change_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Proposte di nuovo materiale KB
CREATE TABLE public.kb_entry_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'paste' CHECK (source IN ('paste','url','file','chat')),
  raw_content TEXT NOT NULL,
  source_url TEXT,
  suggested_category TEXT,
  suggested_chapter TEXT,
  suggested_title TEXT,
  suggested_content TEXT,
  suggested_tags TEXT[] DEFAULT '{}'::TEXT[],
  suggested_priority INTEGER DEFAULT 50,
  conflicts_with UUID[] DEFAULT '{}'::UUID[],
  duplicates_of UUID,
  ai_rationale TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_kb_entry_id UUID,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_kb_entry_proposals_status ON public.kb_entry_proposals(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_kb_entry_proposals_created_by ON public.kb_entry_proposals(created_by);

ALTER TABLE public.kb_entry_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_kb_entry_proposals" ON public.kb_entry_proposals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_kb_entry_proposals" ON public.kb_entry_proposals
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "owner_update_kb_entry_proposals" ON public.kb_entry_proposals
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_kb_entry_proposals_updated
  BEFORE UPDATE ON public.kb_entry_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

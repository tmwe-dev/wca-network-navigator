
ALTER TABLE public.kb_entry_proposals
  ADD COLUMN IF NOT EXISTS target_kb_entry_id uuid NULL,
  ADD COLUMN IF NOT EXISTS operation text NOT NULL DEFAULT 'create' CHECK (operation IN ('create','edit')),
  ADD COLUMN IF NOT EXISTS batch_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_kb_entry_proposals_batch ON public.kb_entry_proposals(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kb_entry_proposals_target ON public.kb_entry_proposals(target_kb_entry_id) WHERE target_kb_entry_id IS NOT NULL;

ALTER TABLE public.prompt_change_proposals
  ADD COLUMN IF NOT EXISTS batch_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_prompt_change_proposals_batch ON public.prompt_change_proposals(batch_id) WHERE batch_id IS NOT NULL;

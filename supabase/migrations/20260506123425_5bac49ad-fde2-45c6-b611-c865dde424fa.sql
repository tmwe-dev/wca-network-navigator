CREATE TABLE IF NOT EXISTS public.ai_classification_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_address text NOT NULL,
  trigger_address_rule_id uuid,
  ai_suggested_group_name text,
  ai_suggested_group_id uuid,
  user_chosen_group_name text NOT NULL,
  user_chosen_group_id uuid NOT NULL,
  sample_message_ids text[] DEFAULT '{}'::text[],
  sample_subjects text[] DEFAULT '{}'::text[],
  proposed_target text NOT NULL CHECK (proposed_target IN ('group','prompt')),
  proposed_target_id uuid,
  proposed_target_name text,
  change_type text NOT NULL DEFAULT 'append_hint',
  proposed_change_text text NOT NULL,
  reasoning text,
  confidence numeric(3,2) DEFAULT 0.0,
  user_note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','rejected','superseded')),
  created_by_user_id uuid,
  created_by_operator_id uuid,
  applied_at timestamptz,
  applied_by_user_id uuid,
  applied_change_summary text,
  rejected_at timestamptz,
  rejected_by_user_id uuid,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aci_status ON public.ai_classification_insights(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aci_target ON public.ai_classification_insights(proposed_target, proposed_target_id);

ALTER TABLE public.ai_classification_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users can read insights"
ON public.ai_classification_insights FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth users can insert insights"
ON public.ai_classification_insights FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth users can update insights"
ON public.ai_classification_insights FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_aci_updated_at
BEFORE UPDATE ON public.ai_classification_insights
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_scope_registry (scope, description, enforcement_mode, requires_grounding, allowed_tools)
VALUES ('learning.classification.refine', 'Refiner: analizza correzione utente su classificazione email e propone modifica regola/prompt', 'warn', false, ARRAY[]::text[])
ON CONFLICT (scope) DO NOTHING;
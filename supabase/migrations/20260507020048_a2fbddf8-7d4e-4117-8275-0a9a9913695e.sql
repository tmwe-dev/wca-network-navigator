
-- KB canonical governance: schema additions
-- - canonical_id: stable identifier for cross-entry references (e.g. "doctrine/canonical-facts")
-- - family: one of 6 canonical families (nullable until classified via proposals)
-- - last_reviewed_at: tracked separately from updated_at for governance reporting
-- No superseded_by column: duplicates removed via existing soft-delete trigger.

ALTER TABLE public.kb_entries
  ADD COLUMN IF NOT EXISTS canonical_id text,
  ADD COLUMN IF NOT EXISTS family text,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;

-- Unique canonical_id (when present)
CREATE UNIQUE INDEX IF NOT EXISTS idx_kb_entries_canonical_id
  ON public.kb_entries (canonical_id)
  WHERE canonical_id IS NOT NULL AND deleted_at IS NULL;

-- Family check constraint (allows NULL during transition)
ALTER TABLE public.kb_entries
  DROP CONSTRAINT IF EXISTS kb_entries_family_check;
ALTER TABLE public.kb_entries
  ADD CONSTRAINT kb_entries_family_check
  CHECK (family IS NULL OR family IN ('doctrine','procedures','personas','playbooks','glossary','data-schema'));

CREATE INDEX IF NOT EXISTS idx_kb_entries_family
  ON public.kb_entries (family)
  WHERE family IS NOT NULL AND deleted_at IS NULL;

-- View: only active, non-deleted entries (canonical view used by harmonizer/audit)
CREATE OR REPLACE VIEW public.v_kb_active_canonical AS
SELECT id, canonical_id, family, category, chapter, title, content, tags,
       priority, last_reviewed_at, updated_at
FROM public.kb_entries
WHERE is_active = true AND deleted_at IS NULL;

GRANT SELECT ON public.v_kb_active_canonical TO authenticated;

-- Audit reports table (snapshots from kb-doctrine-audit edge function)
CREATE TABLE IF NOT EXISTS public.kb_audit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  triggered_by text NOT NULL DEFAULT 'manual',
  total_entries integer NOT NULL DEFAULT 0,
  exact_duplicates integer NOT NULL DEFAULT 0,
  semantic_duplicates integer NOT NULL DEFAULT 0,
  numbers_outside_canonical integer NOT NULL DEFAULT 0,
  entries_without_tags integer NOT NULL DEFAULT 0,
  entries_without_family integer NOT NULL DEFAULT 0,
  family_distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_changes integer NOT NULL DEFAULT 0,
  report_markdown text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.kb_audit_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kb_audit_reports_read_authenticated" ON public.kb_audit_reports;
CREATE POLICY "kb_audit_reports_read_authenticated"
  ON public.kb_audit_reports FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "kb_audit_reports_insert_service" ON public.kb_audit_reports;
-- (insert via service role only; no policy needed for service_role)

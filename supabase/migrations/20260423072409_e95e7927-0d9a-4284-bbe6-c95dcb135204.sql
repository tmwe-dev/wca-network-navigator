CREATE TABLE IF NOT EXISTS public.block_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  block_id text NOT NULL,
  source_table text NOT NULL,
  source_field text,
  source_kind text NOT NULL,
  version_num integer NOT NULL,
  content text NOT NULL,
  previous_content text,
  changed_by uuid REFERENCES auth.users(id),
  changed_by_label text,
  run_id uuid,
  communication_context jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS block_versions_block_id_version_num_unique
  ON public.block_versions(block_id, version_num);
CREATE INDEX IF NOT EXISTS block_versions_block_id_version_desc
  ON public.block_versions(block_id, version_num DESC);
CREATE INDEX IF NOT EXISTS block_versions_created_at_desc
  ON public.block_versions(created_at DESC);

ALTER TABLE public.block_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS block_versions_select_own ON public.block_versions;
CREATE POLICY block_versions_select_own ON public.block_versions
  FOR SELECT USING (changed_by = auth.uid());

DROP POLICY IF EXISTS block_versions_insert_own ON public.block_versions;
CREATE POLICY block_versions_insert_own ON public.block_versions
  FOR INSERT WITH CHECK (changed_by = auth.uid());

ALTER TABLE public.kb_entries ADD COLUMN IF NOT EXISTS communication_context jsonb DEFAULT NULL;
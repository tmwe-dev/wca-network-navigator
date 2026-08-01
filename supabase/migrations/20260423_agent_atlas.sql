-- Create block_versions table for tracking block content history
CREATE TABLE IF NOT EXISTS block_versions (
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

-- Create indexes on block_versions
CREATE UNIQUE INDEX IF NOT EXISTS block_versions_block_id_version_num_unique
  ON block_versions(block_id, version_num);

CREATE INDEX IF NOT EXISTS block_versions_block_id_version_desc
  ON block_versions(block_id, version_num DESC);

CREATE INDEX IF NOT EXISTS block_versions_created_at_desc
  ON block_versions(created_at DESC);

-- Enable Row Level Security on block_versions
ALTER TABLE block_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can SELECT their own records
CREATE POLICY block_versions_select_own
  ON block_versions
  FOR SELECT
  USING (changed_by = auth.uid());

-- RLS Policy: Users can INSERT their own records
CREATE POLICY block_versions_insert_own
  ON block_versions
  FOR INSERT
  WITH CHECK (changed_by = auth.uid());

-- Note: No UPDATE or DELETE policies - block_versions is immutable history

-- Add communication_context column to kb_entries
ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS communication_context jsonb DEFAULT NULL;


-- Add holding pattern fields to partners
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS lead_status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz,
  ADD COLUMN IF NOT EXISTS interaction_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

-- Add holding pattern fields to prospects
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS lead_status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz,
  ADD COLUMN IF NOT EXISTS interaction_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

-- Create prospect_interactions table (partners already have 'interactions' table)
CREATE TABLE IF NOT EXISTS prospect_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  interaction_type text NOT NULL,
  title text NOT NULL,
  description text,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE prospect_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_prospect_interactions_all" ON prospect_interactions
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

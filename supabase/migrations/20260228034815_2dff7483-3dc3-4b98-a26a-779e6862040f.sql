
CREATE TABLE workspace_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  goal text DEFAULT '',
  base_proposal text DEFAULT '',
  document_ids jsonb DEFAULT '[]',
  reference_links jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workspace_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own presets" ON workspace_presets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

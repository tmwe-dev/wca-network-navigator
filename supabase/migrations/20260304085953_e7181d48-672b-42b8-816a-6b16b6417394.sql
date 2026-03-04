
ALTER TABLE imported_contacts
  ADD COLUMN lead_status text NOT NULL DEFAULT 'new',
  ADD COLUMN deep_search_at timestamptz,
  ADD COLUMN last_interaction_at timestamptz,
  ADD COLUMN interaction_count integer NOT NULL DEFAULT 0,
  ADD COLUMN converted_at timestamptz;

CREATE TABLE contact_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES imported_contacts(id) ON DELETE CASCADE,
  interaction_type text NOT NULL,
  title text NOT NULL,
  description text,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE contact_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_contact_interactions_all" ON contact_interactions FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

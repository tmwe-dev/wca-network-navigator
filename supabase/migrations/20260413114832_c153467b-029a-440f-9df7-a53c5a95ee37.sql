ALTER TABLE imported_contacts ADD COLUMN IF NOT EXISTS lead_score integer DEFAULT 0;
ALTER TABLE imported_contacts ADD COLUMN IF NOT EXISTS lead_score_breakdown jsonb DEFAULT '{}';
ALTER TABLE imported_contacts ADD COLUMN IF NOT EXISTS lead_score_updated_at timestamptz;
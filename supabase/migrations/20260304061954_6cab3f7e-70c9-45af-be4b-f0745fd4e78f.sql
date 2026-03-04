ALTER TABLE imported_contacts ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE imported_contacts ADD COLUMN IF NOT EXISTS external_id text;
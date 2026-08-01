ALTER TABLE email_classifications
ADD COLUMN IF NOT EXISTS domain text DEFAULT 'commercial' CHECK (domain IN ('commercial', 'operative', 'administrative', 'support', 'internal'));

CREATE INDEX IF NOT EXISTS idx_classifications_domain ON email_classifications(user_id, domain);

ALTER TABLE email_address_rules
ADD COLUMN IF NOT EXISTS domain_type text CHECK (domain_type IS NULL OR domain_type IN ('commercial', 'operative', 'administrative', 'support', 'internal'));

CREATE INDEX IF NOT EXISTS idx_email_address_rules_domain_type ON email_address_rules(user_id, domain_type);
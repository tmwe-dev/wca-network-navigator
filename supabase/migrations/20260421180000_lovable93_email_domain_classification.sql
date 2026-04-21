-- LOVABLE-93: Add domain-level classification (Livello 1) to email management system

-- Add domain column to email_classifications for Livello 1 classification
ALTER TABLE email_classifications
ADD COLUMN IF NOT EXISTS domain text DEFAULT 'commercial' CHECK (domain IN ('commercial', 'operative', 'administrative', 'support', 'internal'));

-- Create index for domain-based queries
CREATE INDEX IF NOT EXISTS idx_classifications_domain ON email_classifications(user_id, domain);

-- Add domain_type to email_address_rules for manual domain categorization
ALTER TABLE email_address_rules
ADD COLUMN IF NOT EXISTS domain_type text CHECK (domain_type IS NULL OR domain_type IN ('commercial', 'operative', 'administrative', 'support', 'internal'));

-- Create index for domain_type lookups
CREATE INDEX IF NOT EXISTS idx_email_address_rules_domain_type ON email_address_rules(user_id, domain_type);

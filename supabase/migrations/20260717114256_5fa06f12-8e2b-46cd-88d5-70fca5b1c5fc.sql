-- Trigram indexes on email columns to speed up ILIKE %..% searches.
-- Audit 2026-07-17 identified ~7h24m CPU/week across ILIKE scans on
-- partners.email, partner_contacts.email and imported_contacts.email.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_partners_email_trgm
  ON public.partners USING gin (email gin_trgm_ops)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partner_contacts_email_trgm
  ON public.partner_contacts USING gin (email gin_trgm_ops)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_imported_contacts_email_trgm
  ON public.imported_contacts USING gin (email gin_trgm_ops)
  WHERE email IS NOT NULL;
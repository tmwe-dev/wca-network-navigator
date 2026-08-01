-- Speed up Partner Search filters & multi-select on partners table.
-- All indexes scoped to is_active = true AND deleted_at IS NULL (the universal where-clause).

-- Trigram index on company_name to make ilike '%term%' (full text search box) index-driven
CREATE INDEX IF NOT EXISTS idx_partners_company_name_trgm
  ON public.partners USING gin (company_name gin_trgm_ops)
  WHERE is_active = true AND deleted_at IS NULL;

-- Composite (country_code, company_name) for IN(countries) + ORDER BY company_name (default sort)
CREATE INDEX IF NOT EXISTS idx_partners_active_country_name
  ON public.partners (country_code, company_name)
  WHERE is_active = true AND deleted_at IS NULL;

-- Plain (company_name) for "Tutti i paesi" ordering with no country filter
CREATE INDEX IF NOT EXISTS idx_partners_active_name
  ON public.partners (company_name)
  WHERE is_active = true AND deleted_at IS NULL;

-- Sort by rating DESC + tie-break by name
CREATE INDEX IF NOT EXISTS idx_partners_active_rating_name
  ON public.partners (rating DESC NULLS LAST, company_name)
  WHERE is_active = true AND deleted_at IS NULL;

-- Sort by member_since DESC + tie-break by name
CREATE INDEX IF NOT EXISTS idx_partners_active_member_since_name
  ON public.partners (member_since DESC NULLS LAST, company_name)
  WHERE is_active = true AND deleted_at IS NULL;

-- "Hide holding" toggle: lead_status null or 'new'
CREATE INDEX IF NOT EXISTS idx_partners_active_no_holding
  ON public.partners (country_code, company_name)
  WHERE is_active = true AND deleted_at IS NULL
        AND (lead_status IS NULL OR lead_status = 'new');

-- Quality filters (with_email / no_email / with_profile)
CREATE INDEX IF NOT EXISTS idx_partners_active_with_email
  ON public.partners (country_code, company_name)
  WHERE is_active = true AND deleted_at IS NULL AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partners_active_no_email
  ON public.partners (country_code, company_name)
  WHERE is_active = true AND deleted_at IS NULL AND email IS NULL;

CREATE INDEX IF NOT EXISTS idx_partners_active_with_profile
  ON public.partners (country_code, company_name)
  WHERE is_active = true AND deleted_at IS NULL AND raw_profile_html IS NOT NULL;

-- Refresh planner stats so the new indexes are picked up immediately
ANALYZE public.partners;
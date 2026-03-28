-- ══════════════════════════════════════════════════════════════════
-- Report Aziende (RA) Module — Tables & RLS
-- ══════════════════════════════════════════════════════════════════

-- ── Prospects (scraped companies) ──
CREATE TABLE IF NOT EXISTS ra_prospects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_name  TEXT NOT NULL,
  partita_iva   TEXT,
  codice_fiscale TEXT,
  address       TEXT,
  cap           TEXT,
  city          TEXT,
  province      TEXT,
  region        TEXT,
  phone         TEXT,
  email         TEXT,
  pec           TEXT,
  website       TEXT,
  fatturato     NUMERIC,
  utile         NUMERIC,
  dipendenti    INTEGER,
  anno_bilancio INTEGER,
  codice_ateco  TEXT,
  descrizione_ateco TEXT,
  forma_giuridica TEXT,
  data_costituzione TEXT,
  rating_affidabilita TEXT,
  credit_score  NUMERIC,
  source_url    TEXT,
  raw_profile_html TEXT,
  lead_status   TEXT NOT NULL DEFAULT 'new'
    CHECK (lead_status IN ('new','contacted','qualified','negotiation','converted','lost')),
  notes         TEXT,
  tags          TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ra_prospects_piva_idx ON ra_prospects(partita_iva) WHERE partita_iva IS NOT NULL;
CREATE INDEX IF NOT EXISTS ra_prospects_ateco_idx ON ra_prospects(codice_ateco);
CREATE INDEX IF NOT EXISTS ra_prospects_region_idx ON ra_prospects(region);
CREATE INDEX IF NOT EXISTS ra_prospects_status_idx ON ra_prospects(lead_status);
CREATE INDEX IF NOT EXISTS ra_prospects_created_idx ON ra_prospects(created_at DESC);

-- ── Contacts (dirigenti / key people) ──
CREATE TABLE IF NOT EXISTS ra_contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id   UUID NOT NULL REFERENCES ra_prospects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  role          TEXT,
  codice_fiscale TEXT,
  email         TEXT,
  phone         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ra_contacts_prospect_idx ON ra_contacts(prospect_id);

-- ── Scraping Jobs ──
CREATE TABLE IF NOT EXISTS ra_scraping_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  job_type        TEXT NOT NULL CHECK (job_type IN ('search','scrape_batch','scrape_single')),
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','cancelled')),
  ateco_codes     TEXT[],
  regions         TEXT[],
  provinces       TEXT[],
  min_fatturato   NUMERIC,
  max_fatturato   NUMERIC,
  total_items     INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  saved_items     INTEGER NOT NULL DEFAULT 0,
  error_count     INTEGER NOT NULL DEFAULT 0,
  delay_seconds   NUMERIC NOT NULL DEFAULT 3,
  batch_size      INTEGER NOT NULL DEFAULT 10,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_log       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ra_jobs_status_idx ON ra_scraping_jobs(status);
CREATE INDEX IF NOT EXISTS ra_jobs_created_idx ON ra_scraping_jobs(created_at DESC);

-- ── Interactions (CRM activities on prospects) ──
CREATE TABLE IF NOT EXISTS ra_interactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id      UUID NOT NULL REFERENCES ra_prospects(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('call','email','meeting','note','pec')),
  title            TEXT NOT NULL,
  description      TEXT,
  outcome          TEXT,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ra_interactions_prospect_idx ON ra_interactions(prospect_id);

-- ── RLS Policies ──
ALTER TABLE ra_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_scraping_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_interactions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can do everything (team-wide access)
CREATE POLICY "ra_prospects_all" ON ra_prospects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ra_contacts_all" ON ra_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ra_scraping_jobs_all" ON ra_scraping_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ra_interactions_all" ON ra_interactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── updated_at trigger ──
CREATE OR REPLACE FUNCTION ra_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ra_prospects_updated_at
  BEFORE UPDATE ON ra_prospects
  FOR EACH ROW
  EXECUTE FUNCTION ra_set_updated_at();

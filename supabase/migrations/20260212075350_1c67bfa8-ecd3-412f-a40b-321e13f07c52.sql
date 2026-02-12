
-- ══════════════════════════════════════════════
-- Prospects (aziende italiane da ReportAziende)
-- ══════════════════════════════════════════════
CREATE TABLE public.prospects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  partita_iva TEXT,
  codice_fiscale TEXT,
  city TEXT,
  province TEXT,
  region TEXT,
  address TEXT,
  cap TEXT,
  phone TEXT,
  email TEXT,
  pec TEXT,
  website TEXT,
  fatturato NUMERIC,
  utile NUMERIC,
  dipendenti INTEGER,
  anno_bilancio INTEGER,
  codice_ateco TEXT,
  descrizione_ateco TEXT,
  forma_giuridica TEXT,
  data_costituzione DATE,
  rating_affidabilita TEXT,
  credit_score NUMERIC,
  source TEXT NOT NULL DEFAULT 'reportaziende',
  raw_profile_html TEXT,
  enrichment_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on prospects" ON public.prospects FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_prospects_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════════════
-- Prospect Contacts (manager/responsabili)
-- ══════════════════════════════════════════════
CREATE TABLE public.prospect_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  codice_fiscale TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prospect_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on prospect_contacts" ON public.prospect_contacts FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════
-- Prospect Social Links
-- ══════════════════════════════════════════════
CREATE TABLE public.prospect_social_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.prospect_contacts(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prospect_social_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on prospect_social_links" ON public.prospect_social_links FOR ALL USING (true) WITH CHECK (true);

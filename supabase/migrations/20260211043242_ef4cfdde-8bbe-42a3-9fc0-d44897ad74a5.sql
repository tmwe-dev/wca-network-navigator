
-- Blacklist entries table
CREATE TABLE public.blacklist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blacklist_no integer,
  company_name text NOT NULL,
  city text,
  country text,
  status text,
  claims text,
  total_owed_amount numeric,
  matched_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for fast matching
CREATE INDEX idx_blacklist_company_name ON public.blacklist_entries (LOWER(company_name));
CREATE INDEX idx_blacklist_country ON public.blacklist_entries (LOWER(country));
CREATE INDEX idx_blacklist_matched_partner ON public.blacklist_entries (matched_partner_id);

-- Enable RLS
ALTER TABLE public.blacklist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on blacklist_entries" ON public.blacklist_entries FOR ALL USING (true) WITH CHECK (true);

-- Sync log table
CREATE TABLE public.blacklist_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL,
  entries_count integer DEFAULT 0,
  matched_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.blacklist_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on blacklist_sync_log" ON public.blacklist_sync_log FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at on blacklist_entries
CREATE TRIGGER update_blacklist_entries_updated_at
  BEFORE UPDATE ON public.blacklist_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

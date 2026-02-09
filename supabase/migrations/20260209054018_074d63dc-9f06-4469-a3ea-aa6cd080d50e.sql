
-- Cache for directory scan results so the system remembers what was found
CREATE TABLE public.directory_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL,
  network_name TEXT NOT NULL DEFAULT '',
  members JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_results INTEGER NOT NULL DEFAULT 0,
  total_pages INTEGER NOT NULL DEFAULT 0,
  scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(country_code, network_name)
);

-- Enable RLS
ALTER TABLE public.directory_cache ENABLE ROW LEVEL SECURITY;

-- Open access (no auth in this app)
CREATE POLICY "Allow all on directory_cache" ON public.directory_cache
  FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.directory_cache;

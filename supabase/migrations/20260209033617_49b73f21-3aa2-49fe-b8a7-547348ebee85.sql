
-- Enum for download queue status
CREATE TYPE public.download_queue_status AS ENUM ('pending', 'in_progress', 'completed', 'paused');

-- Table: network_configs
CREATE TABLE public.network_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_name TEXT NOT NULL UNIQUE,
  is_member BOOLEAN NOT NULL DEFAULT false,
  has_contact_emails BOOLEAN NOT NULL DEFAULT false,
  has_contact_names BOOLEAN NOT NULL DEFAULT false,
  has_contact_phones BOOLEAN NOT NULL DEFAULT false,
  sample_tested_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.network_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_network_configs_select" ON public.network_configs FOR SELECT USING (true);
CREATE POLICY "public_network_configs_insert" ON public.network_configs FOR INSERT WITH CHECK (true);
CREATE POLICY "public_network_configs_update" ON public.network_configs FOR UPDATE USING (true);
CREATE POLICY "public_network_configs_delete" ON public.network_configs FOR DELETE USING (true);

-- Table: download_queue
CREATE TABLE public.download_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code CHAR(2) NOT NULL,
  country_name TEXT NOT NULL,
  network_name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  id_range_start INTEGER,
  id_range_end INTEGER,
  status public.download_queue_status NOT NULL DEFAULT 'pending',
  total_found INTEGER NOT NULL DEFAULT 0,
  total_processed INTEGER NOT NULL DEFAULT 0,
  last_processed_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.download_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_download_queue_select" ON public.download_queue FOR SELECT USING (true);
CREATE POLICY "public_download_queue_insert" ON public.download_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "public_download_queue_update" ON public.download_queue FOR UPDATE USING (true);
CREATE POLICY "public_download_queue_delete" ON public.download_queue FOR DELETE USING (true);

-- Seed known WCA networks
INSERT INTO public.network_configs (network_name, is_member) VALUES
  ('WCAworld', false),
  ('AWS (Alliance of Worldwide Shippers)', false),
  ('GAA (Global Agents Alliance)', false),
  ('GPLN (Global Project Logistics Network)', false),
  ('GLA (Global Logistics Associates)', false),
  ('JCTrans', false),
  ('Freightbook', false),
  ('X2 Logistic Networks', false);

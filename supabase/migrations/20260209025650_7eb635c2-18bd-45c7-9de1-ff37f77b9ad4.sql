-- Add enrichment columns to partners table
ALTER TABLE public.partners
ADD COLUMN IF NOT EXISTS enrichment_data jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS enriched_at timestamp with time zone DEFAULT NULL;

ALTER TABLE public.activities 
  ADD COLUMN source_type text NOT NULL DEFAULT 'partner',
  ADD COLUMN source_id uuid;

-- Backfill source_id from existing partner_id
UPDATE public.activities SET source_id = partner_id WHERE source_id IS NULL;

-- Make source_id NOT NULL after backfill
ALTER TABLE public.activities ALTER COLUMN source_id SET NOT NULL;

-- Make partner_id nullable for future prospect/contact activities
ALTER TABLE public.activities ALTER COLUMN partner_id DROP NOT NULL;

-- Add constraint: source_type must be one of the valid types
ALTER TABLE public.activities ADD CONSTRAINT activities_source_type_check 
  CHECK (source_type IN ('partner', 'prospect', 'contact'));

-- Index for efficient filtering by source
CREATE INDEX idx_activities_source ON public.activities (source_type, source_id);

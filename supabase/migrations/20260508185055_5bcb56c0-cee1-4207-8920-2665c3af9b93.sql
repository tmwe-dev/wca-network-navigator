ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_source_type_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_source_type_check
  CHECK (source_type = ANY (ARRAY['partner'::text, 'prospect'::text, 'contact'::text, 'channel_message'::text]));
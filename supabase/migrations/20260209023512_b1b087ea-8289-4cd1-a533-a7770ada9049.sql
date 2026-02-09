ALTER TABLE public.partners ADD COLUMN rating numeric(2,1) DEFAULT NULL;
ALTER TABLE public.partners ADD COLUMN rating_details jsonb DEFAULT NULL;
ALTER TABLE public.business_cards ADD COLUMN IF NOT EXISTS ocr_confidence jsonb DEFAULT '{}';
ALTER TABLE public.business_cards ADD COLUMN IF NOT EXISTS manually_corrected boolean DEFAULT false;
ALTER TABLE public.business_cards ADD COLUMN IF NOT EXISTS correction_notes text;
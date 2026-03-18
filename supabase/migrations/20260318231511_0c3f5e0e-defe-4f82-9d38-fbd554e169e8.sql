
-- Create business_cards table
CREATE TABLE public.business_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_name TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  position TEXT,
  event_name TEXT,
  met_at TIMESTAMPTZ,
  location TEXT,
  notes TEXT,
  photo_url TEXT,
  matched_partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  matched_contact_id UUID REFERENCES public.imported_contacts(id) ON DELETE SET NULL,
  match_confidence INTEGER DEFAULT 0,
  match_status TEXT NOT NULL DEFAULT 'pending',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_data JSONB
);

-- Enable RLS
ALTER TABLE public.business_cards ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage own business_cards"
ON public.business_cards FOR ALL
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Auto-matching trigger function
CREATE OR REPLACE FUNCTION public.match_business_card()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_partner_id UUID;
  v_contact_id UUID;
  v_confidence INT := 0;
  v_status TEXT := 'unmatched';
BEGIN
  -- Try matching partner by company_name
  IF NEW.company_name IS NOT NULL AND NEW.company_name != '' THEN
    SELECT id INTO v_partner_id
    FROM partners
    WHERE company_name ILIKE '%' || NEW.company_name || '%'
       OR company_alias ILIKE '%' || NEW.company_name || '%'
    LIMIT 1;
    
    IF v_partner_id IS NOT NULL THEN
      v_confidence := 70;
      v_status := 'matched';
    END IF;
  END IF;

  -- Try matching by email (higher confidence)
  IF v_partner_id IS NULL AND NEW.email IS NOT NULL AND NEW.email != '' THEN
    SELECT p.id INTO v_partner_id
    FROM partners p
    WHERE p.email ILIKE NEW.email
    LIMIT 1;
    
    IF v_partner_id IS NULL THEN
      SELECT pc.partner_id INTO v_partner_id
      FROM partner_contacts pc
      WHERE pc.email ILIKE NEW.email
      LIMIT 1;
    END IF;
    
    IF v_partner_id IS NOT NULL THEN
      v_confidence := 90;
      v_status := 'matched';
    END IF;
  END IF;

  -- Try matching imported_contacts
  IF NEW.company_name IS NOT NULL AND NEW.company_name != '' THEN
    SELECT id INTO v_contact_id
    FROM imported_contacts
    WHERE company_name ILIKE '%' || NEW.company_name || '%'
    LIMIT 1;
    
    IF v_contact_id IS NOT NULL AND v_confidence < 70 THEN
      v_confidence := 60;
      v_status := 'matched';
    END IF;
  END IF;

  IF v_contact_id IS NULL AND NEW.email IS NOT NULL AND NEW.email != '' THEN
    SELECT id INTO v_contact_id
    FROM imported_contacts
    WHERE email ILIKE NEW.email
    LIMIT 1;
    
    IF v_contact_id IS NOT NULL THEN
      IF v_confidence < 90 THEN v_confidence := 85; END IF;
      v_status := 'matched';
    END IF;
  END IF;

  NEW.matched_partner_id := v_partner_id;
  NEW.matched_contact_id := v_contact_id;
  NEW.match_confidence := v_confidence;
  NEW.match_status := v_status;

  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trg_match_business_card
BEFORE INSERT ON public.business_cards
FOR EACH ROW
EXECUTE FUNCTION public.match_business_card();

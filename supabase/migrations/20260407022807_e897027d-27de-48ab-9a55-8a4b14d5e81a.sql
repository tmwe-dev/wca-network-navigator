
-- Add WCA matching columns to imported_contacts
ALTER TABLE public.imported_contacts
  ADD COLUMN IF NOT EXISTS wca_partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wca_match_confidence SMALLINT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_imported_contacts_wca_partner ON public.imported_contacts(wca_partner_id) WHERE wca_partner_id IS NOT NULL;

-- Batch matching function
CREATE OR REPLACE FUNCTION public.match_contacts_to_wca()
RETURNS TABLE(matched_count INT, total_processed INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_matched INT := 0;
  v_total INT := 0;
  rec RECORD;
  v_partner_id UUID;
  v_confidence SMALLINT;
  v_email_domain TEXT;
  v_card_country TEXT;
  v_temp_id UUID;
  v_temp_country TEXT;
BEGIN
  FOR rec IN
    SELECT id, email, company_name, company_alias, country
    FROM imported_contacts
    WHERE wca_partner_id IS NULL
      AND (company_name IS NOT NULL OR email IS NOT NULL)
  LOOP
    v_total := v_total + 1;
    v_partner_id := NULL;
    v_confidence := 0;
    v_email_domain := NULL;
    v_card_country := rec.country;

    -- Extract email domain
    IF rec.email IS NOT NULL AND rec.email LIKE '%@%' THEN
      v_email_domain := lower(split_part(rec.email, '@', 2));
      IF v_email_domain IN ('gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com',
                            'aol.com','live.com','mail.com','protonmail.com','qq.com',
                            '163.com','126.com','yandex.com','gmx.com','web.de') THEN
        v_email_domain := NULL;
      END IF;
    END IF;

    -- PASS 1: Exact email on partners
    IF rec.email IS NOT NULL AND rec.email != '' THEN
      SELECT id INTO v_partner_id FROM partners WHERE email ILIKE rec.email LIMIT 1;
      IF v_partner_id IS NOT NULL THEN v_confidence := 95; END IF;
    END IF;

    -- PASS 2: Exact email on partner_contacts
    IF v_partner_id IS NULL AND rec.email IS NOT NULL AND rec.email != '' THEN
      SELECT partner_id INTO v_partner_id FROM partner_contacts WHERE email ILIKE rec.email LIMIT 1;
      IF v_partner_id IS NOT NULL THEN v_confidence := 93; END IF;
    END IF;

    -- PASS 3: Email domain on partners
    IF v_partner_id IS NULL AND v_email_domain IS NOT NULL THEN
      SELECT id, country_name INTO v_temp_id, v_temp_country FROM partners WHERE email ILIKE '%@' || v_email_domain LIMIT 1;
      IF v_temp_id IS NOT NULL THEN
        v_partner_id := v_temp_id;
        v_confidence := 80;
        IF v_card_country IS NOT NULL AND v_temp_country IS NOT NULL AND lower(v_card_country) = lower(v_temp_country) THEN
          v_confidence := 88;
        END IF;
      END IF;
    END IF;

    -- PASS 4: Email domain on partner_contacts
    IF v_partner_id IS NULL AND v_email_domain IS NOT NULL THEN
      SELECT pc.partner_id INTO v_temp_id FROM partner_contacts pc WHERE pc.email ILIKE '%@' || v_email_domain LIMIT 1;
      IF v_temp_id IS NOT NULL THEN
        v_partner_id := v_temp_id;
        v_confidence := 78;
      END IF;
    END IF;

    -- PASS 5: Company name exact match
    IF v_partner_id IS NULL AND rec.company_name IS NOT NULL AND rec.company_name != '' THEN
      SELECT id, country_name INTO v_temp_id, v_temp_country FROM partners
        WHERE company_name ILIKE rec.company_name OR company_alias ILIKE rec.company_name LIMIT 1;
      IF v_temp_id IS NOT NULL THEN
        v_partner_id := v_temp_id;
        v_confidence := 75;
        IF v_card_country IS NOT NULL AND v_temp_country IS NOT NULL AND lower(v_card_country) = lower(v_temp_country) THEN
          v_confidence := 85;
        END IF;
      END IF;
    END IF;

    -- PASS 5b: Also try company_alias from imported_contacts
    IF v_partner_id IS NULL AND rec.company_alias IS NOT NULL AND rec.company_alias != '' THEN
      SELECT id, country_name INTO v_temp_id, v_temp_country FROM partners
        WHERE company_name ILIKE rec.company_alias OR company_alias ILIKE rec.company_alias LIMIT 1;
      IF v_temp_id IS NOT NULL THEN
        v_partner_id := v_temp_id;
        v_confidence := 73;
        IF v_card_country IS NOT NULL AND v_temp_country IS NOT NULL AND lower(v_card_country) = lower(v_temp_country) THEN
          v_confidence := 83;
        END IF;
      END IF;
    END IF;

    -- PASS 6: Company name partial match
    IF v_partner_id IS NULL AND rec.company_name IS NOT NULL AND length(rec.company_name) > 3 THEN
      SELECT id, country_name INTO v_temp_id, v_temp_country FROM partners
        WHERE company_name ILIKE '%' || rec.company_name || '%' OR company_alias ILIKE '%' || rec.company_name || '%' LIMIT 1;
      IF v_temp_id IS NOT NULL THEN
        v_partner_id := v_temp_id;
        v_confidence := 65;
        IF v_card_country IS NOT NULL AND v_temp_country IS NOT NULL AND lower(v_card_country) = lower(v_temp_country) THEN
          v_confidence := 75;
        END IF;
      END IF;
    END IF;

    -- Update if matched
    IF v_partner_id IS NOT NULL THEN
      UPDATE imported_contacts SET wca_partner_id = v_partner_id, wca_match_confidence = v_confidence WHERE id = rec.id;
      v_matched := v_matched + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_matched, v_total;
END;
$$;

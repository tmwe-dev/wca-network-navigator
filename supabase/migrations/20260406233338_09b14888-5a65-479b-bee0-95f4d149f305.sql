
CREATE OR REPLACE FUNCTION public.match_business_card()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_partner_id UUID;
  v_contact_id UUID;
  v_confidence INT := 0;
  v_status TEXT := 'unmatched';
  v_email_domain TEXT;
  v_card_country TEXT;
  v_temp_partner_id UUID;
  v_temp_confidence INT;
  v_temp_country TEXT;
BEGIN
  -- Extract email domain
  IF NEW.email IS NOT NULL AND NEW.email LIKE '%@%' THEN
    v_email_domain := lower(split_part(NEW.email, '@', 2));
    -- Skip generic domains
    IF v_email_domain IN ('gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com',
                          'aol.com','live.com','mail.com','protonmail.com','qq.com',
                          '163.com','126.com','yandex.com','gmx.com','web.de') THEN
      v_email_domain := NULL;
    END IF;
  END IF;

  -- Extract country from location (last part after comma, or whole string)
  IF NEW.location IS NOT NULL AND NEW.location != '' THEN
    v_card_country := trim(split_part(NEW.location, ',', 
      array_length(string_to_array(NEW.location, ','), 1)));
  END IF;

  -- ═══ PASS 1: Exact email match on partner (highest confidence) ═══
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    SELECT id INTO v_partner_id
    FROM partners
    WHERE email ILIKE NEW.email
    LIMIT 1;

    IF v_partner_id IS NOT NULL THEN
      v_confidence := 95;
      v_status := 'matched';
    END IF;
  END IF;

  -- ═══ PASS 2: Exact email match on partner_contacts ═══
  IF v_partner_id IS NULL AND NEW.email IS NOT NULL AND NEW.email != '' THEN
    SELECT partner_id INTO v_partner_id
    FROM partner_contacts
    WHERE email ILIKE NEW.email
    LIMIT 1;

    IF v_partner_id IS NOT NULL THEN
      v_confidence := 93;
      v_status := 'matched';
    END IF;
  END IF;

  -- ═══ PASS 3: Email domain match on partner email ═══
  IF v_partner_id IS NULL AND v_email_domain IS NOT NULL THEN
    SELECT id, country_name INTO v_temp_partner_id, v_temp_country
    FROM partners
    WHERE email ILIKE '%@' || v_email_domain
    LIMIT 1;

    IF v_temp_partner_id IS NOT NULL THEN
      v_partner_id := v_temp_partner_id;
      v_confidence := 80;
      -- Boost if country also matches
      IF v_card_country IS NOT NULL AND v_temp_country IS NOT NULL 
         AND lower(v_card_country) = lower(v_temp_country) THEN
        v_confidence := 88;
      END IF;
      v_status := 'matched';
    END IF;
  END IF;

  -- ═══ PASS 4: Email domain match on partner_contacts ═══
  IF v_partner_id IS NULL AND v_email_domain IS NOT NULL THEN
    SELECT pc.partner_id INTO v_temp_partner_id
    FROM partner_contacts pc
    WHERE pc.email ILIKE '%@' || v_email_domain
    LIMIT 1;

    IF v_temp_partner_id IS NOT NULL THEN
      v_partner_id := v_temp_partner_id;
      v_confidence := 78;
      v_status := 'matched';
    END IF;
  END IF;

  -- ═══ PASS 5: Company name match (exact-ish) + country boost ═══
  IF v_partner_id IS NULL AND NEW.company_name IS NOT NULL AND NEW.company_name != '' THEN
    -- Try exact ilike match first
    SELECT id, country_name INTO v_temp_partner_id, v_temp_country
    FROM partners
    WHERE company_name ILIKE NEW.company_name
       OR company_alias ILIKE NEW.company_name
    LIMIT 1;

    IF v_temp_partner_id IS NOT NULL THEN
      v_partner_id := v_temp_partner_id;
      v_confidence := 75;
      IF v_card_country IS NOT NULL AND v_temp_country IS NOT NULL 
         AND lower(v_card_country) = lower(v_temp_country) THEN
        v_confidence := 85;
      END IF;
      v_status := 'matched';
    END IF;
  END IF;

  -- ═══ PASS 6: Company name partial match + country boost ═══
  IF v_partner_id IS NULL AND NEW.company_name IS NOT NULL AND length(NEW.company_name) > 3 THEN
    SELECT id, country_name INTO v_temp_partner_id, v_temp_country
    FROM partners
    WHERE company_name ILIKE '%' || NEW.company_name || '%'
       OR company_alias ILIKE '%' || NEW.company_name || '%'
    LIMIT 1;

    IF v_temp_partner_id IS NOT NULL THEN
      v_partner_id := v_temp_partner_id;
      v_confidence := 65;
      IF v_card_country IS NOT NULL AND v_temp_country IS NOT NULL 
         AND lower(v_card_country) = lower(v_temp_country) THEN
        v_confidence := 75;
      END IF;
      v_status := 'matched';
    END IF;
  END IF;

  -- ═══ PASS 7: Match imported_contacts by email or name ═══
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    SELECT id INTO v_contact_id
    FROM imported_contacts
    WHERE email ILIKE NEW.email
    LIMIT 1;

    IF v_contact_id IS NOT NULL AND v_confidence < 85 THEN
      v_confidence := GREATEST(v_confidence, 85);
      v_status := 'matched';
    END IF;
  END IF;

  IF v_contact_id IS NULL AND v_email_domain IS NOT NULL THEN
    SELECT id INTO v_contact_id
    FROM imported_contacts
    WHERE email ILIKE '%@' || v_email_domain
    LIMIT 1;

    IF v_contact_id IS NOT NULL AND v_confidence < 70 THEN
      v_confidence := GREATEST(v_confidence, 70);
      v_status := 'matched';
    END IF;
  END IF;

  IF v_contact_id IS NULL AND NEW.company_name IS NOT NULL AND NEW.company_name != '' THEN
    SELECT id INTO v_contact_id
    FROM imported_contacts
    WHERE company_name ILIKE '%' || NEW.company_name || '%'
    LIMIT 1;

    IF v_contact_id IS NOT NULL AND v_confidence < 60 THEN
      v_confidence := GREATEST(v_confidence, 60);
      v_status := 'matched';
    END IF;
  END IF;

  NEW.matched_partner_id := v_partner_id;
  NEW.matched_contact_id := v_contact_id;
  NEW.match_confidence := v_confidence;
  NEW.match_status := v_status;

  RETURN NEW;
END;
$function$;

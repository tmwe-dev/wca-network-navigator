
-- 1. partners
UPDATE public.partners
SET lead_status = CASE lead_status
  WHEN 'contacted' THEN 'first_touch_sent'
  WHEN 'in_progress' THEN 'holding'
  WHEN 'qualified' THEN 'engaged'
  WHEN 'lost' THEN 'archived'
  ELSE lead_status
END
WHERE lead_status IN ('contacted','in_progress','qualified','lost');

-- 2. imported_contacts
UPDATE public.imported_contacts
SET lead_status = CASE lead_status
  WHEN 'contacted' THEN 'first_touch_sent'
  WHEN 'in_progress' THEN 'holding'
  WHEN 'qualified' THEN 'engaged'
  WHEN 'lost' THEN 'archived'
  ELSE lead_status
END
WHERE lead_status IN ('contacted','in_progress','qualified','lost');

-- 3. business_cards
UPDATE public.business_cards
SET lead_status = CASE lead_status
  WHEN 'contacted' THEN 'first_touch_sent'
  WHEN 'in_progress' THEN 'holding'
  WHEN 'qualified' THEN 'engaged'
  WHEN 'lost' THEN 'archived'
  ELSE lead_status
END
WHERE lead_status IN ('contacted','in_progress','qualified','lost');

-- 4. prospects
UPDATE public.prospects
SET lead_status = CASE lead_status
  WHEN 'contacted' THEN 'first_touch_sent'
  WHEN 'in_progress' THEN 'holding'
  WHEN 'qualified' THEN 'engaged'
  WHEN 'lost' THEN 'archived'
  ELSE lead_status
END
WHERE lead_status IN ('contacted','in_progress','qualified','lost');

-- 5. Riscrittura sync_bca_lead_status_to_partner() con nuovi 9 stati
CREATE OR REPLACE FUNCTION public.sync_bca_lead_status_to_partner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_old int;
  v_order_new int;
BEGIN
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status AND NEW.matched_partner_id IS NOT NULL THEN
    IF NEW.lead_status IN ('archived','blacklisted') THEN
      RETURN NEW;
    END IF;

    v_order_old := CASE OLD.lead_status
      WHEN 'new' THEN 0
      WHEN 'first_touch_sent' THEN 1
      WHEN 'holding' THEN 2
      WHEN 'engaged' THEN 3
      WHEN 'qualified' THEN 4
      WHEN 'negotiation' THEN 5
      WHEN 'converted' THEN 6
      ELSE 0
    END;
    v_order_new := CASE NEW.lead_status
      WHEN 'new' THEN 0
      WHEN 'first_touch_sent' THEN 1
      WHEN 'holding' THEN 2
      WHEN 'engaged' THEN 3
      WHEN 'qualified' THEN 4
      WHEN 'negotiation' THEN 5
      WHEN 'converted' THEN 6
      ELSE 0
    END;

    IF v_order_new > v_order_old THEN
      UPDATE public.partners
      SET lead_status = NEW.lead_status
      WHERE id = NEW.matched_partner_id
        AND lead_status NOT IN ('archived','blacklisted')
        AND (CASE lead_status
          WHEN 'new' THEN 0
          WHEN 'first_touch_sent' THEN 1
          WHEN 'holding' THEN 2
          WHEN 'engaged' THEN 3
          WHEN 'qualified' THEN 4
          WHEN 'negotiation' THEN 5
          WHEN 'converted' THEN 6
          ELSE 0
        END) < v_order_new;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

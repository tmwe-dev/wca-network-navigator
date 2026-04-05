
-- Add lead_status to business_cards
ALTER TABLE public.business_cards
ADD COLUMN IF NOT EXISTS lead_status text NOT NULL DEFAULT 'new';

-- Backfill: sync existing BCAs from their matched partner
UPDATE public.business_cards bc
SET lead_status = p.lead_status
FROM public.partners p
WHERE bc.matched_partner_id = p.id
  AND p.lead_status IS NOT NULL
  AND p.lead_status != 'new';

-- Trigger function: when partner lead_status changes, update matched BCAs
CREATE OR REPLACE FUNCTION public.sync_partner_lead_status_to_bca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
    UPDATE public.business_cards
    SET lead_status = NEW.lead_status
    WHERE matched_partner_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_partner_lead_to_bca
AFTER UPDATE OF lead_status ON public.partners
FOR EACH ROW
EXECUTE FUNCTION public.sync_partner_lead_status_to_bca();

-- Trigger function: when BCA lead_status changes, update matched partner
CREATE OR REPLACE FUNCTION public.sync_bca_lead_status_to_partner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_old int;
  v_order_new int;
BEGIN
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status AND NEW.matched_partner_id IS NOT NULL THEN
    -- Only escalate: new < contacted < in_progress < negotiation < converted
    v_order_old := CASE OLD.lead_status
      WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 WHEN 'in_progress' THEN 2
      WHEN 'negotiation' THEN 3 WHEN 'converted' THEN 4 ELSE 0 END;
    v_order_new := CASE NEW.lead_status
      WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 WHEN 'in_progress' THEN 2
      WHEN 'negotiation' THEN 3 WHEN 'converted' THEN 4 ELSE 0 END;

    IF v_order_new > v_order_old THEN
      UPDATE public.partners
      SET lead_status = NEW.lead_status
      WHERE id = NEW.matched_partner_id
        AND (CASE lead_status
          WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 WHEN 'in_progress' THEN 2
          WHEN 'negotiation' THEN 3 WHEN 'converted' THEN 4 ELSE 0 END) < v_order_new;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_bca_lead_to_partner
AFTER UPDATE OF lead_status ON public.business_cards
FOR EACH ROW
EXECUTE FUNCTION public.sync_bca_lead_status_to_partner();

-- Colonna status_reason per archiviazione/blacklist con motivo visibile inline
ALTER TABLE public.imported_contacts
  ADD COLUMN IF NOT EXISTS status_reason TEXT;

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS status_reason TEXT;

-- Index parziale: recupera velocemente gli archiviati/blacklist con motivo
CREATE INDEX IF NOT EXISTS idx_imported_contacts_status_reason
  ON public.imported_contacts(lead_status)
  WHERE status_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partners_status_reason
  ON public.partners(lead_status)
  WHERE status_reason IS NOT NULL;

-- Trigger: pulisce status_reason quando il contatto torna a uno stato attivo
CREATE OR REPLACE FUNCTION public.clear_status_reason_on_reactivation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_status IS DISTINCT FROM OLD.lead_status
     AND NEW.lead_status NOT IN ('archived','blacklisted')
     AND OLD.lead_status IN ('archived','blacklisted') THEN
    NEW.status_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_status_reason_imported_contacts ON public.imported_contacts;
CREATE TRIGGER trg_clear_status_reason_imported_contacts
  BEFORE UPDATE ON public.imported_contacts
  FOR EACH ROW EXECUTE FUNCTION public.clear_status_reason_on_reactivation();

DROP TRIGGER IF EXISTS trg_clear_status_reason_partners ON public.partners;
CREATE TRIGGER trg_clear_status_reason_partners
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.clear_status_reason_on_reactivation();
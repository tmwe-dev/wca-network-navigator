-- Fix match_email_sender: prospects table has no contact_name column.
-- Use company_name as display_name to remove the runtime warning seen in check-inbox logs.
CREATE OR REPLACE FUNCTION public.match_email_sender(p_user_id uuid, p_email text, p_domain text)
RETURNS TABLE(
  source_type text,
  source_id uuid,
  partner_id uuid,
  display_name text,
  company_name text,
  email_confidence integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Exact match partners
  RETURN QUERY
    SELECT 'partner'::text, p.id, p.id, p.company_name, p.company_name, 100
    FROM public.partners p
    WHERE lower(p.email) = lower(p_email)
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- Exact match partner_contacts
  RETURN QUERY
    SELECT 'partner_contact'::text, pc.id, pc.partner_id, pc.name, p2.company_name, 100
    FROM public.partner_contacts pc
    JOIN public.partners p2 ON pc.partner_id = p2.id
    WHERE lower(pc.email) = lower(p_email)
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- Exact match imported_contacts (scoped per user)
  RETURN QUERY
    SELECT 'imported_contact'::text, ic.id, ic.wca_partner_id, ic.name, ic.company_name, 100
    FROM public.imported_contacts ic
    WHERE lower(ic.email) = lower(p_email)
      AND ic.user_id = p_user_id
      AND ic.deleted_at IS NULL
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- Exact match prospects (no contact_name column → fallback to company_name)
  RETURN QUERY
    SELECT 'prospect'::text, pr.id, NULL::uuid, pr.company_name, pr.company_name, 100
    FROM public.prospects pr
    WHERE lower(pr.email) = lower(p_email)
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- Domain fallback (confidence 50)
  IF p_domain IS NOT NULL AND p_domain <> '' THEN
    RETURN QUERY
      SELECT 'partner_domain'::text, p.id, p.id, p.company_name, p.company_name, 50
      FROM public.partners p
      WHERE lower(p.email) LIKE '%@' || lower(p_domain)
      LIMIT 1;
    IF FOUND THEN RETURN; END IF;

    RETURN QUERY
      SELECT 'partner_contact_domain'::text, pc.id, pc.partner_id, pc.name, p2.company_name, 50
      FROM public.partner_contacts pc
      JOIN public.partners p2 ON pc.partner_id = p2.id
      WHERE lower(pc.email) LIKE '%@' || lower(p_domain)
      LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_email_sender(uuid, text, text) TO authenticated, service_role;
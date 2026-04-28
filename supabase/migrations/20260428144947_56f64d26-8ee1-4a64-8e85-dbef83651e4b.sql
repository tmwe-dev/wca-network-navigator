-- P5.2: soft-link post-transfer (no physical delete)
ALTER TABLE public.imported_contacts
  ADD COLUMN IF NOT EXISTS transferred_to_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transferred_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_imported_contacts_transferred_partner
  ON public.imported_contacts(transferred_to_partner_id)
  WHERE transferred_to_partner_id IS NOT NULL;

-- Backfill timestamp per record già trasferiti
UPDATE public.imported_contacts
   SET transferred_at = COALESCE(transferred_at, created_at)
 WHERE is_transferred = true AND transferred_at IS NULL;

-- P5.3: helper per marcare import_logs stuck come expired
CREATE OR REPLACE FUNCTION public.expire_stuck_import_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE public.import_logs
     SET status = 'expired',
         completed_at = COALESCE(completed_at, now())
   WHERE status IN ('pending', 'processing')
     AND created_at < now() - interval '30 minutes'
     AND deleted_at IS NULL;
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

-- P5.1: dedup lookup per il wizard di import
CREATE OR REPLACE FUNCTION public.find_import_duplicates(
  p_user_id uuid,
  p_emails text[],
  p_company_names text[]
)
RETURNS TABLE(
  match_email text,
  match_company text,
  imported_contact_id uuid,
  partner_id uuid,
  source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH em AS (
    SELECT DISTINCT lower(trim(e)) AS email
      FROM unnest(coalesce(p_emails, ARRAY[]::text[])) AS e
     WHERE e IS NOT NULL AND trim(e) <> ''
  ),
  co AS (
    SELECT DISTINCT lower(trim(c)) AS company
      FROM unnest(coalesce(p_company_names, ARRAY[]::text[])) AS c
     WHERE c IS NOT NULL AND trim(c) <> ''
  )
  SELECT lower(ic.email) AS match_email,
         ic.company_name AS match_company,
         ic.id AS imported_contact_id,
         ic.transferred_to_partner_id AS partner_id,
         'imported_contact'::text AS source
    FROM public.imported_contacts ic
    JOIN em ON em.email = lower(ic.email)
   WHERE ic.user_id = p_user_id
     AND ic.deleted_at IS NULL
     AND ic.email IS NOT NULL
  UNION ALL
  SELECT lower(p.email) AS match_email,
         p.company_name AS match_company,
         NULL::uuid AS imported_contact_id,
         p.id AS partner_id,
         'partner'::text AS source
    FROM public.partners p
    JOIN em ON em.email = lower(p.email)
   WHERE p.deleted_at IS NULL
     AND p.email IS NOT NULL
  UNION ALL
  SELECT NULL::text AS match_email,
         p.company_name AS match_company,
         NULL::uuid AS imported_contact_id,
         p.id AS partner_id,
         'partner_company'::text AS source
    FROM public.partners p
    JOIN co ON co.company = lower(trim(p.company_name))
   WHERE p.deleted_at IS NULL
     AND p.company_name IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.find_import_duplicates(uuid, text[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stuck_import_logs() TO authenticated, service_role;
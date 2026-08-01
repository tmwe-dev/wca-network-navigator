
-- 1) Sibling auto-hold fields on partner_contacts
ALTER TABLE public.partner_contacts
  ADD COLUMN IF NOT EXISTS parent_contact_id uuid REFERENCES public.partner_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_held_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_held_reason text;

CREATE INDEX IF NOT EXISTS idx_partner_contacts_auto_held
  ON public.partner_contacts(auto_held_at)
  WHERE auto_held_at IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_partner_contacts_parent
  ON public.partner_contacts(parent_contact_id)
  WHERE parent_contact_id IS NOT NULL AND deleted_at IS NULL;

-- 2) Company name normalization
CREATE OR REPLACE FUNCTION public.normalize_company_name(name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(
        lower(coalesce(name, '')),
        '\s+(s\.?p\.?a\.?|s\.?r\.?l\.?|s\.?n\.?c\.?|s\.?a\.?s\.?|inc\.?|ltd\.?|llc\.?|gmbh|ag|co\.?|corp\.?|corporation|company|group|holding|limited)\b',
        '',
        'gi'
      ),
      '[^a-z0-9]+',
      '',
      'g'
    ),
    ''
  );
$$;

CREATE INDEX IF NOT EXISTS idx_partners_company_name_normalized
  ON public.partners(public.normalize_company_name(company_name))
  WHERE company_name IS NOT NULL AND deleted_at IS NULL;

-- 3) Apply sibling holding RPC
CREATE OR REPLACE FUNCTION public.apply_sibling_holding(_parent_contact_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _parent_partner_id uuid;
  _parent_company_norm text;
  _affected integer := 0;
BEGIN
  IF _parent_contact_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT pc.partner_id, public.normalize_company_name(p.company_name)
    INTO _parent_partner_id, _parent_company_norm
  FROM public.partner_contacts pc
  JOIN public.partners p ON p.id = pc.partner_id
  WHERE pc.id = _parent_contact_id
    AND pc.deleted_at IS NULL;

  IF _parent_partner_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH target_partners AS (
    SELECT id FROM public.partners
    WHERE deleted_at IS NULL
      AND (
        id = _parent_partner_id
        OR (
          _parent_company_norm IS NOT NULL
          AND public.normalize_company_name(company_name) = _parent_company_norm
        )
      )
  ),
  updated AS (
    UPDATE public.partner_contacts pc
       SET parent_contact_id = _parent_contact_id,
           auto_held_at = now(),
           auto_held_reason = 'auto_held_by_sibling'
     WHERE pc.deleted_at IS NULL
       AND pc.id <> _parent_contact_id
       AND pc.partner_id IN (SELECT id FROM target_partners)
       AND pc.auto_held_at IS NULL
     RETURNING pc.id
  )
  SELECT count(*) INTO _affected FROM updated;

  RETURN _affected;
END;
$$;

-- 4) Sibling risk check RPC (used by approval UI)
CREATE OR REPLACE FUNCTION public.check_sibling_risk(
  _partner_id uuid,
  _contact_id uuid DEFAULT NULL,
  _window_days integer DEFAULT 30
)
RETURNS TABLE (
  sibling_contact_id uuid,
  sibling_contact_name text,
  sibling_partner_id uuid,
  sibling_company_name text,
  same_company boolean,
  last_outbound_at timestamptz,
  channel text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target_company AS (
    SELECT public.normalize_company_name(company_name) AS norm
    FROM public.partners
    WHERE id = _partner_id AND deleted_at IS NULL
  ),
  target_partners AS (
    SELECT p.id, p.company_name,
           (p.id = _partner_id) AS same_partner
    FROM public.partners p, target_company tc
    WHERE p.deleted_at IS NULL
      AND (
        p.id = _partner_id
        OR (
          tc.norm IS NOT NULL
          AND public.normalize_company_name(p.company_name) = tc.norm
        )
      )
  ),
  recent_outbound AS (
    SELECT cm.partner_id,
           cm.to_address,
           cm.channel,
           max(cm.created_at) AS last_outbound_at
    FROM public.channel_messages cm
    WHERE cm.direction = 'outbound'
      AND cm.partner_id IN (SELECT id FROM target_partners)
      AND cm.created_at >= now() - make_interval(days => _window_days)
    GROUP BY cm.partner_id, cm.to_address, cm.channel
  )
  SELECT pc.id           AS sibling_contact_id,
         pc.name         AS sibling_contact_name,
         pc.partner_id   AS sibling_partner_id,
         tp.company_name AS sibling_company_name,
         NOT tp.same_partner AS same_company,
         ro.last_outbound_at,
         ro.channel
  FROM public.partner_contacts pc
  JOIN target_partners tp ON tp.id = pc.partner_id
  JOIN recent_outbound ro
    ON ro.partner_id = pc.partner_id
   AND (
     ro.to_address = pc.email
     OR ro.to_address = pc.direct_phone
     OR ro.to_address = pc.mobile
   )
  WHERE pc.deleted_at IS NULL
    AND (_contact_id IS NULL OR pc.id <> _contact_id)
  ORDER BY ro.last_outbound_at DESC;
$$;

-- 5) Trigger: on first outbound, auto-hold siblings
CREATE OR REPLACE FUNCTION public.trg_apply_sibling_holding_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _contact_id uuid;
BEGIN
  IF NEW.direction <> 'outbound' OR NEW.partner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- find originating contact by to_address match within partner
  SELECT id INTO _contact_id
  FROM public.partner_contacts
  WHERE partner_id = NEW.partner_id
    AND deleted_at IS NULL
    AND (
      email = NEW.to_address
      OR direct_phone = NEW.to_address
      OR mobile = NEW.to_address
    )
  ORDER BY is_primary DESC NULLS LAST, created_at ASC
  LIMIT 1;

  IF _contact_id IS NOT NULL THEN
    PERFORM public.apply_sibling_holding(_contact_id);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- never block outbound message insert
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_sibling_holding_on_outbound ON public.channel_messages;
CREATE TRIGGER trg_apply_sibling_holding_on_outbound
AFTER INSERT ON public.channel_messages
FOR EACH ROW
EXECUTE FUNCTION public.trg_apply_sibling_holding_fn();

GRANT EXECUTE ON FUNCTION public.apply_sibling_holding(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_sibling_risk(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_company_name(text) TO authenticated, anon;

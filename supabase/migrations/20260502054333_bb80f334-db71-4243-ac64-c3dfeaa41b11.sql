-- ============================================================================
-- Dedup partner_contacts — 2026-05-02
-- Problema: ~107k righe duplicate su 137k (78%). Esempio: "Randy Emmons"
-- presente 4 volte sullo stesso partner Radiant Global Logistics.
-- ============================================================================

-- 1) Backup di sicurezza (snapshot completo, recuperabile)
CREATE TABLE IF NOT EXISTS public.partner_contacts_backup_2026_05_02 AS
SELECT * FROM public.partner_contacts;

-- 2) Per ogni gruppo duplicato, individuiamo il "winner" (created_at più
--    antico, a parità id minore) e copiamo sul winner i campi utili
--    (coalesce con il primo non-null trovato negli altri duplicati).
WITH ranked AS (
  SELECT
    id,
    partner_id,
    lower(coalesce(email, '')) AS email_norm,
    lower(coalesce(name, ''))  AS name_norm,
    title,
    direct_phone,
    mobile,
    contact_alias,
    is_primary,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY partner_id, lower(coalesce(email, '')), lower(coalesce(name, ''))
      ORDER BY created_at NULLS LAST, id
    ) AS rn,
    COUNT(*) OVER (
      PARTITION BY partner_id, lower(coalesce(email, '')), lower(coalesce(name, ''))
    ) AS grp_size
  FROM public.partner_contacts
  WHERE deleted_at IS NULL
),
winners AS (
  SELECT * FROM ranked WHERE rn = 1 AND grp_size > 1
),
losers AS (
  SELECT * FROM ranked WHERE rn > 1
),
-- Aggregato dei valori utili dai loser per ogni gruppo (primo non-null)
loser_agg AS (
  SELECT
    partner_id,
    email_norm,
    name_norm,
    (ARRAY_AGG(title ORDER BY created_at) FILTER (WHERE title IS NOT NULL AND title <> ''))[1] AS title_fb,
    (ARRAY_AGG(direct_phone ORDER BY created_at) FILTER (WHERE direct_phone IS NOT NULL AND direct_phone <> ''))[1] AS dphone_fb,
    (ARRAY_AGG(mobile ORDER BY created_at) FILTER (WHERE mobile IS NOT NULL AND mobile <> ''))[1] AS mobile_fb,
    (ARRAY_AGG(contact_alias ORDER BY created_at) FILTER (WHERE contact_alias IS NOT NULL AND contact_alias <> ''))[1] AS alias_fb,
    bool_or(coalesce(is_primary, false)) AS prim_fb
  FROM losers
  GROUP BY partner_id, email_norm, name_norm
)
UPDATE public.partner_contacts pc
SET
  title         = COALESCE(NULLIF(pc.title, ''), la.title_fb),
  direct_phone  = COALESCE(NULLIF(pc.direct_phone, ''), la.dphone_fb),
  mobile        = COALESCE(NULLIF(pc.mobile, ''), la.mobile_fb),
  contact_alias = COALESCE(NULLIF(pc.contact_alias, ''), la.alias_fb),
  is_primary    = COALESCE(pc.is_primary, false) OR la.prim_fb
FROM winners w
JOIN loser_agg la
  ON la.partner_id = w.partner_id
 AND la.email_norm = w.email_norm
 AND la.name_norm  = w.name_norm
WHERE pc.id = w.id;

-- 3) Soft-delete dei duplicati (rn > 1). Il trigger globale no-physical-delete
--    converte automaticamente DELETE -> UPDATE deleted_at.
DELETE FROM public.partner_contacts pc
USING (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY partner_id, lower(coalesce(email, '')), lower(coalesce(name, ''))
        ORDER BY created_at NULLS LAST, id
      ) AS rn
    FROM public.partner_contacts
    WHERE deleted_at IS NULL
  ) r WHERE r.rn > 1
) losers
WHERE pc.id = losers.id;

-- 4) Vincolo UNIQUE parziale: previene la ricomparsa di duplicati identici.
--    Si applica solo ai record attivi (deleted_at IS NULL) per non collidere
--    con i soft-deleted lasciati per audit.
CREATE UNIQUE INDEX IF NOT EXISTS partner_contacts_dedup_uniq
  ON public.partner_contacts (partner_id, lower(coalesce(email, '')), lower(coalesce(name, '')))
  WHERE deleted_at IS NULL;

-- 5) Report
DO $$
DECLARE
  active_count BIGINT;
  remaining_dups BIGINT;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM public.partner_contacts WHERE deleted_at IS NULL;

  SELECT COUNT(*) INTO remaining_dups
  FROM (
    SELECT 1 FROM public.partner_contacts
    WHERE deleted_at IS NULL
    GROUP BY partner_id, lower(coalesce(email, '')), lower(coalesce(name, ''))
    HAVING COUNT(*) > 1
  ) x;

  RAISE NOTICE 'Dedup completata. Contatti attivi: %. Gruppi duplicati residui: %.', active_count, remaining_dups;
END $$;
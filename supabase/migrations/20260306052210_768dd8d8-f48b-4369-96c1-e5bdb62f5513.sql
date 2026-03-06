
CREATE OR REPLACE FUNCTION public.get_contact_group_counts()
RETURNS TABLE (
  group_type text,
  group_key text,
  group_label text,
  contact_count bigint,
  with_email bigint,
  with_phone bigint,
  with_deep_search bigint,
  with_alias bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  -- Quality filter: at least one of company_name, name, email must be non-null
  WITH base AS (
    SELECT *
    FROM imported_contacts
    WHERE company_name IS NOT NULL OR name IS NOT NULL OR email IS NOT NULL
  )
  -- Country groups
  SELECT
    'country'::text as group_type,
    COALESCE(country, '??') as group_key,
    COALESCE(country, 'Sconosciuto') as group_label,
    COUNT(*)::bigint as contact_count,
    COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')::bigint as with_email,
    COUNT(*) FILTER (WHERE phone IS NOT NULL OR mobile IS NOT NULL)::bigint as with_phone,
    COUNT(*) FILTER (WHERE deep_search_at IS NOT NULL)::bigint as with_deep_search,
    COUNT(*) FILTER (WHERE company_alias IS NOT NULL)::bigint as with_alias
  FROM base
  GROUP BY country

  UNION ALL

  -- Origin groups
  SELECT
    'origin'::text,
    COALESCE(origin, 'Sconosciuta'),
    COALESCE(origin, 'Sconosciuta'),
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')::bigint,
    COUNT(*) FILTER (WHERE phone IS NOT NULL OR mobile IS NOT NULL)::bigint,
    COUNT(*) FILTER (WHERE deep_search_at IS NOT NULL)::bigint,
    COUNT(*) FILTER (WHERE company_alias IS NOT NULL)::bigint
  FROM base
  GROUP BY origin

  UNION ALL

  -- Status groups
  SELECT
    'status'::text,
    lead_status,
    CASE lead_status
      WHEN 'new' THEN 'Nuovo'
      WHEN 'contacted' THEN 'Contattato'
      WHEN 'in_progress' THEN 'In corso'
      WHEN 'negotiation' THEN 'Trattativa'
      WHEN 'converted' THEN 'Cliente'
      WHEN 'lost' THEN 'Perso'
      ELSE lead_status
    END,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')::bigint,
    COUNT(*) FILTER (WHERE phone IS NOT NULL OR mobile IS NOT NULL)::bigint,
    COUNT(*) FILTER (WHERE deep_search_at IS NOT NULL)::bigint,
    COUNT(*) FILTER (WHERE company_alias IS NOT NULL)::bigint
  FROM base
  GROUP BY lead_status

  UNION ALL

  -- Date (month) groups
  SELECT
    'date'::text,
    COALESCE(to_char(created_at, 'YYYY-MM'), 'nd'),
    COALESCE(to_char(created_at, 'YYYY-MM'), 'Senza data'),
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')::bigint,
    COUNT(*) FILTER (WHERE phone IS NOT NULL OR mobile IS NOT NULL)::bigint,
    COUNT(*) FILTER (WHERE deep_search_at IS NOT NULL)::bigint,
    COUNT(*) FILTER (WHERE company_alias IS NOT NULL)::bigint
  FROM base
  GROUP BY to_char(created_at, 'YYYY-MM')

  ORDER BY group_type, contact_count DESC;
$$;


CREATE OR REPLACE FUNCTION public.get_contact_group_counts()
 RETURNS TABLE(group_type text, group_key text, group_label text, contact_count bigint, with_email bigint, with_phone bigint, with_deep_search bigint, with_alias bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT *
    FROM imported_contacts
    WHERE company_name IS NOT NULL OR name IS NOT NULL OR email IS NOT NULL
  ),
  combined AS (
    SELECT
      'country'::text as group_type,
      COALESCE(country, '??') as group_key,
      COALESCE(country, 'Sconosciuto') as group_label,
      COUNT(*)::bigint as contact_count,
      COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')::bigint as with_email,
      COUNT(*) FILTER (WHERE phone IS NOT NULL OR mobile IS NOT NULL)::bigint as with_phone,
      COUNT(*) FILTER (WHERE deep_search_at IS NOT NULL)::bigint as with_deep_search,
      COUNT(*) FILTER (WHERE company_alias IS NOT NULL)::bigint as with_alias
    FROM base GROUP BY country
    UNION ALL
    SELECT 'origin'::text, COALESCE(origin, 'Sconosciuta'), COALESCE(origin, 'Sconosciuta'),
      COUNT(*)::bigint,
      COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')::bigint,
      COUNT(*) FILTER (WHERE phone IS NOT NULL OR mobile IS NOT NULL)::bigint,
      COUNT(*) FILTER (WHERE deep_search_at IS NOT NULL)::bigint,
      COUNT(*) FILTER (WHERE company_alias IS NOT NULL)::bigint
    FROM base GROUP BY origin
    UNION ALL
    SELECT 'status'::text, lead_status,
      CASE lead_status
        WHEN 'new' THEN 'Nuovo'
        WHEN 'first_touch_sent' THEN 'Primo contatto'
        WHEN 'holding' THEN 'In attesa'
        WHEN 'engaged' THEN 'Coinvolto'
        WHEN 'qualified' THEN 'Qualificato'
        WHEN 'negotiation' THEN 'Trattativa'
        WHEN 'converted' THEN 'Cliente'
        WHEN 'archived' THEN 'Archiviato'
        WHEN 'blacklisted' THEN 'Blacklist'
        ELSE lead_status
      END,
      COUNT(*)::bigint,
      COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')::bigint,
      COUNT(*) FILTER (WHERE phone IS NOT NULL OR mobile IS NOT NULL)::bigint,
      COUNT(*) FILTER (WHERE deep_search_at IS NOT NULL)::bigint,
      COUNT(*) FILTER (WHERE company_alias IS NOT NULL)::bigint
    FROM base GROUP BY lead_status
    UNION ALL
    SELECT 'date'::text, COALESCE(to_char(created_at, 'YYYY-MM'), 'nd'),
      COALESCE(to_char(created_at, 'YYYY-MM'), 'Senza data'),
      COUNT(*)::bigint,
      COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')::bigint,
      COUNT(*) FILTER (WHERE phone IS NOT NULL OR mobile IS NOT NULL)::bigint,
      COUNT(*) FILTER (WHERE deep_search_at IS NOT NULL)::bigint,
      COUNT(*) FILTER (WHERE company_alias IS NOT NULL)::bigint
    FROM base GROUP BY to_char(created_at, 'YYYY-MM')
  )
  SELECT * FROM combined ORDER BY group_type, contact_count DESC;
$function$;

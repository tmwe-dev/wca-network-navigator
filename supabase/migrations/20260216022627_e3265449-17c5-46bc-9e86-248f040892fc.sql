
-- Server-side aggregation function: returns ALL country stats in one query
-- This avoids the 1000-row client-side limit that was causing wrong counts
CREATE OR REPLACE FUNCTION public.get_country_stats()
RETURNS TABLE(
  country_code text,
  total_partners bigint,
  hq_count bigint,
  branch_count bigint,
  with_profile bigint,
  without_profile bigint,
  with_email bigint,
  with_phone bigint,
  with_both bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH partner_base AS (
    SELECT 
      p.id,
      p.country_code,
      p.office_type,
      CASE WHEN p.raw_profile_html IS NOT NULL THEN 1 ELSE 0 END as has_profile
    FROM partners p
    WHERE p.country_code IS NOT NULL
  ),
  contact_agg AS (
    SELECT 
      pc.partner_id,
      BOOL_OR(pc.email IS NOT NULL) as has_email,
      BOOL_OR(pc.direct_phone IS NOT NULL OR pc.mobile IS NOT NULL) as has_phone
    FROM partner_contacts pc
    GROUP BY pc.partner_id
  )
  SELECT
    pb.country_code,
    COUNT(*)::bigint as total_partners,
    COUNT(*) FILTER (WHERE pb.office_type IS DISTINCT FROM 'branch')::bigint as hq_count,
    COUNT(*) FILTER (WHERE pb.office_type = 'branch')::bigint as branch_count,
    SUM(pb.has_profile)::bigint as with_profile,
    (COUNT(*) - SUM(pb.has_profile))::bigint as without_profile,
    COUNT(*) FILTER (WHERE ca.has_email = true)::bigint as with_email,
    COUNT(*) FILTER (WHERE ca.has_phone = true)::bigint as with_phone,
    COUNT(*) FILTER (WHERE ca.has_email = true AND ca.has_phone = true)::bigint as with_both
  FROM partner_base pb
  LEFT JOIN contact_agg ca ON ca.partner_id = pb.id
  GROUP BY pb.country_code;
$$;

CREATE OR REPLACE FUNCTION public.get_contact_filter_options()
RETURNS TABLE(filter_type text, filter_value text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  (SELECT 'origin'::text as filter_type, origin as filter_value
   FROM imported_contacts
   WHERE origin IS NOT NULL AND origin != ''
     AND (company_name IS NOT NULL OR name IS NOT NULL OR email IS NOT NULL)
   GROUP BY origin)
  UNION ALL
  (SELECT 'country'::text as filter_type, country as filter_value
   FROM imported_contacts
   WHERE country IS NOT NULL AND country != ''
     AND (company_name IS NOT NULL OR name IS NOT NULL OR email IS NOT NULL)
   GROUP BY country)
  ORDER BY filter_type, filter_value
$$;
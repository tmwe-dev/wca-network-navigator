
CREATE OR REPLACE FUNCTION get_directory_counts()
RETURNS TABLE(country_code text, member_count bigint, is_verified boolean)
LANGUAGE sql STABLE
AS $$
  SELECT 
    dc.country_code,
    SUM(jsonb_array_length(dc.members))::bigint as member_count,
    BOOL_AND(dc.download_verified) as is_verified
  FROM directory_cache dc
  GROUP BY dc.country_code;
$$;

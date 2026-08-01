
CREATE OR REPLACE FUNCTION public.increment_agent_stat(p_agent_id uuid, p_stat_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE agents
  SET stats = jsonb_set(
    COALESCE(stats::jsonb, '{}'::jsonb),
    ARRAY[p_stat_key],
    to_jsonb(COALESCE((stats::jsonb ->> p_stat_key)::int, 0) + 1)
  ),
  updated_at = now()
  WHERE id = p_agent_id;
END;
$$;

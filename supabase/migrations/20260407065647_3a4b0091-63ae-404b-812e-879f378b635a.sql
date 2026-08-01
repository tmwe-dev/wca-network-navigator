
CREATE OR REPLACE FUNCTION public.increment_memory_access(memory_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ai_memory
  SET access_count = access_count + 1,
      last_accessed_at = now()
  WHERE id = ANY(memory_ids);
END;
$$;

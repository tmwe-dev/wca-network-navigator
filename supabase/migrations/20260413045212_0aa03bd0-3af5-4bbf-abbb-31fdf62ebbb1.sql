-- Add access tracking to kb_entries
ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS access_count integer DEFAULT 0;
ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz;

-- RPC to increment access count for multiple KB entries at once
CREATE OR REPLACE FUNCTION public.increment_kb_access(entry_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE kb_entries
  SET access_count = access_count + 1,
      last_accessed_at = now()
  WHERE id = ANY(entry_ids);
END;
$$;
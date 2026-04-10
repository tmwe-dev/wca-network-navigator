CREATE OR REPLACE FUNCTION public.increment_partner_interaction(p_partner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE partners
  SET interaction_count = COALESCE(interaction_count, 0) + 1,
      last_interaction_at = now()
  WHERE id = p_partner_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.increment_contact_interaction(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE imported_contacts
  SET interaction_count = interaction_count + 1,
      last_interaction_at = now()
  WHERE id = p_contact_id;
END;
$$;
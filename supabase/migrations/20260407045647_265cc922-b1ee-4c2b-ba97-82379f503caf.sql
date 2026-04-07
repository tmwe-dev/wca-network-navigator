
-- Trigger function to increment interaction_count on imported_contacts
CREATE OR REPLACE FUNCTION public.increment_contact_interaction_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE imported_contacts
  SET interaction_count = interaction_count + 1,
      last_interaction_at = NOW()
  WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$$;

-- Create trigger on contact_interactions
CREATE TRIGGER trg_increment_interaction_count
AFTER INSERT ON public.contact_interactions
FOR EACH ROW
EXECUTE FUNCTION public.increment_contact_interaction_count();

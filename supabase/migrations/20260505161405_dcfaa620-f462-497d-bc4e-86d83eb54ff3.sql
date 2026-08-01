-- Fix: admin sees all operators' data via RLS by default.
-- The header operator selector is client-side only and cannot set Postgres GUC
-- session variables, so the previous logic (current_setting('app.master_mode'))
-- never activated and admins were stuck seeing only their own records.
CREATE OR REPLACE FUNCTION public.get_effective_operator_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
BEGIN
  v_is_admin := public.is_operator_admin();
  -- Admins always see data of every active operator (master view at DB level).
  -- Client-side selector narrows the view in UI but RLS does not block it.
  IF v_is_admin THEN
    RETURN ARRAY(SELECT id FROM public.operators WHERE is_active = true);
  END IF;
  -- Non-admin: only their own operator id.
  RETURN ARRAY[public.get_active_operator_id()];
END;
$function$;
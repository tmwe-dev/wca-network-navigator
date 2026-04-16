
-- Drop the broken trigger on profiles that duplicates welcome credits
-- (handle_new_user on auth.users already grants credits correctly)
DROP TRIGGER IF EXISTS trg_grant_welcome_credits ON public.profiles;

-- Fix the function to use user_id instead of id (in case it's called elsewhere)
CREATE OR REPLACE FUNCTION public.grant_welcome_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.credit_transactions (user_id, amount, operation, description)
  VALUES (NEW.user_id, 100, 'topup', 'Crediti di benvenuto');
  RETURN NEW;
END;
$function$;

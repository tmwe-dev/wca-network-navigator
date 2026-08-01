-- ROLLBACK di 20260730_02_fix_security_definer_views.sql — CREATE-ONLY, NON APPLICATO.
-- Ripristina la semantica SECURITY DEFINER (comportamento pre-fix).
ALTER VIEW public.funnemail_jobs_v      SET (security_invoker = false);
ALTER VIEW public.v_kb_active_canonical SET (security_invoker = false);

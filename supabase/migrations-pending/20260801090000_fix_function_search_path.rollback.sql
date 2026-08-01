-- ROLLBACK di 20260730_01_fix_function_search_path.sql — CREATE-ONLY, NON APPLICATO.
-- Rimuove il search_path esplicito ripristinando lo stato pre-fix (mutable).
ALTER FUNCTION public._cron_invoke_edge_sql(text)  RESET search_path;
ALTER FUNCTION public.normalize_company_name(text) RESET search_path;

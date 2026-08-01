-- ============================================================================
-- FASE B — FIX 1/2: search_path esplicito sulle funzioni applicative
-- STATO: CREATE-ONLY. NON APPLICATA. Non eseguire senza autorizzazione.
-- Finding linter: 0011_function_search_path_mutable (WARN 12, WARN 13)
--
-- Oggetti in scope (SOLO funzioni di proprietà applicativa):
--   public._cron_invoke_edge_sql(fn_name text)
--   public.normalize_company_name(name text)
--
-- ESCLUSE deliberatamente: tutte le funzioni dell'estensione pg_trgm
-- (similarity, word_similarity, show_trgm, set_limit, ...). Sono di proprietà
-- dell'estensione: alterarle rompe pg_dump/upgrade dell'estensione.
--
-- Idempotente: ALTER FUNCTION ... SET è ripetibile senza effetti collaterali.
-- Nessun cambio di body, volatilità, owner, grants, RLS o dati.
-- ============================================================================

-- ---------- PREFLIGHT ASSERTIONS ----------
DO $preflight$
BEGIN
  IF to_regprocedure('public._cron_invoke_edge_sql(text)') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: public._cron_invoke_edge_sql(text) non esiste';
  END IF;
  IF to_regprocedure('public.normalize_company_name(text)') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: public.normalize_company_name(text) non esiste';
  END IF;
  -- normalize_company_name è usata in un indice funzionale su public.partners:
  -- deve restare IMMUTABLE, altrimenti l'indice diventa invalido.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'normalize_company_name' AND p.provolatile = 'i'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: normalize_company_name non è IMMUTABLE';
  END IF;
END
$preflight$;

-- ---------- FIX ----------
ALTER FUNCTION public._cron_invoke_edge_sql(text)  SET search_path = public, pg_catalog;
ALTER FUNCTION public.normalize_company_name(text) SET search_path = public, pg_catalog;

-- ---------- POSTFLIGHT ASSERTIONS ----------
DO $postflight$
DECLARE missing int;
BEGIN
  SELECT count(*) INTO missing
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('_cron_invoke_edge_sql', 'normalize_company_name')
    AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%');
  IF missing > 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAIL: % funzioni ancora senza search_path', missing;
  END IF;
  -- L'indice funzionale deve restare valido.
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relname = 'idx_partners_company_name_normalized' AND i.indisvalid
  ) THEN
    RAISE EXCEPTION 'POSTFLIGHT FAIL: idx_partners_company_name_normalized non valido';
  END IF;
END
$postflight$;

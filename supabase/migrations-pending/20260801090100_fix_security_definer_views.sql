-- ============================================================================
-- FASE B — FIX 2/2: security_invoker sulle 2 SECURITY DEFINER view
-- STATO: CREATE-ONLY. NON APPLICATA. Non eseguire senza autorizzazione.
-- Finding linter: 0010_security_definer_view (ERROR 10, ERROR 11)
--
-- Oggetti: public.funnemail_jobs_v, public.v_kb_active_canonical
-- Tutte le altre 12 view public hanno già reloptions {security_invoker=true}.
--
-- Fix scelto: ALTER VIEW ... SET (security_invoker = true).
-- NON si usa CREATE OR REPLACE: evita di riscrivere la definizione, quindi
-- colonne, ordine colonne, tipi, owner (postgres) e GRANT restano intatti
-- per costruzione. Idempotente.
--
-- IMPATTO SEMANTICO REALE: con security_invoker le RLS delle tabelle
-- sottostanti vengono valutate con l'identità del chiamante.
--   - funnemail_jobs_v  -> funnemail_message_status/claims/decisions/reminders/
--                          escalation_events (tutte con RLS e policy per utente)
--   - v_kb_active_canonical -> kb_entries (RLS attiva)
-- Chi legge queste view deve avere policy SELECT sulle tabelle base.
-- VERIFICARE PRIMA su ambiente non produttivo (vedi preflight/postflight).
-- ============================================================================

-- ---------- PREFLIGHT ASSERTIONS ----------
DO $preflight$
BEGIN
  IF to_regclass('public.funnemail_jobs_v') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: public.funnemail_jobs_v non esiste';
  END IF;
  IF to_regclass('public.v_kb_active_canonical') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: public.v_kb_active_canonical non esiste';
  END IF;
  IF (SELECT count(*) FROM pg_attribute
      WHERE attrelid = 'public.funnemail_jobs_v'::regclass AND attnum > 0 AND NOT attisdropped) <> 22 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: funnemail_jobs_v non ha 22 colonne attese';
  END IF;
  IF (SELECT count(*) FROM pg_attribute
      WHERE attrelid = 'public.v_kb_active_canonical'::regclass AND attnum > 0 AND NOT attisdropped) <> 11 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: v_kb_active_canonical non ha 11 colonne attese';
  END IF;
END
$preflight$;

-- ---------- FIX ----------
ALTER VIEW public.funnemail_jobs_v     SET (security_invoker = true);
ALTER VIEW public.v_kb_active_canonical SET (security_invoker = true);

-- ---------- POSTFLIGHT ASSERTIONS ----------
DO $postflight$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'v'
    AND c.relname IN ('funnemail_jobs_v', 'v_kb_active_canonical')
    AND coalesce(c.reloptions::text, '') NOT ILIKE '%security_invoker=true%';
  IF bad > 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAIL: % view senza security_invoker', bad;
  END IF;
  IF (SELECT count(*) FROM pg_attribute
      WHERE attrelid = 'public.funnemail_jobs_v'::regclass AND attnum > 0 AND NOT attisdropped) <> 22 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAIL: colonne funnemail_jobs_v cambiate';
  END IF;
  IF (SELECT count(*) FROM pg_attribute
      WHERE attrelid = 'public.v_kb_active_canonical'::regclass AND attnum > 0 AND NOT attisdropped) <> 11 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAIL: colonne v_kb_active_canonical cambiate';
  END IF;
END
$postflight$;

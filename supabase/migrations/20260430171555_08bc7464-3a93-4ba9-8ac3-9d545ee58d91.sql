
-- Rollback TMWE integration: drop everything created in the previous migration

-- 1. Drop colonna su partners (nessun dato presente)
DROP INDEX IF EXISTS public.partners_tmwe_anagrafica_idx;
ALTER TABLE public.partners DROP COLUMN IF EXISTS tmwe_anagrafica_id;

-- 2. Drop le 5 tabelle TMWE (CASCADE rimuove anche trigger/policy/index)
DROP TABLE IF EXISTS public.tmwe_anagrafica_cache CASCADE;
DROP TABLE IF EXISTS public.tmwe_webhook_events CASCADE;
DROP TABLE IF EXISTS public.tmwe_shipments CASCADE;
DROP TABLE IF EXISTS public.tmwe_quotes CASCADE;
DROP TABLE IF EXISTS public.tmwe_oauth_token CASCADE;

-- 3. Drop la funzione helper updated_at dedicata
DROP FUNCTION IF EXISTS public.tmwe_set_updated_at() CASCADE;

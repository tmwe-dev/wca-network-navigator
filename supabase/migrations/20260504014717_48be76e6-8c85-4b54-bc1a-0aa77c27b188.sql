-- Reset Deep Search completo (richiesto da utente — uso interno)
BEGIN;

-- 1) Investigazioni Sherlock/Detective/Scout: cancella tutto
TRUNCATE TABLE public.sherlock_investigations;

-- 2) Partners: pulisci enrichment_data (contiene deep_search_at) e alias auto
UPDATE public.partners
   SET enrichment_data = '{}'::jsonb,
       enriched_at     = NULL,
       company_alias   = NULL,
       rating          = NULL,
       rating_details  = NULL
 WHERE deleted_at IS NULL
   AND (enrichment_data <> '{}'::jsonb
        OR enriched_at IS NOT NULL
        OR company_alias IS NOT NULL
        OR rating IS NOT NULL
        OR rating_details IS NOT NULL);

-- 3) Partner contacts: alias auto
UPDATE public.partner_contacts
   SET contact_alias = NULL
 WHERE contact_alias IS NOT NULL;

-- 4) Imported contacts: deep_search + alias + lead_score
UPDATE public.imported_contacts
   SET deep_search_at        = NULL,
       company_alias         = NULL,
       contact_alias         = NULL,
       lead_score            = NULL,
       lead_score_breakdown  = NULL,
       lead_score_updated_at = NULL
 WHERE deep_search_at IS NOT NULL
    OR company_alias IS NOT NULL
    OR contact_alias IS NOT NULL
    OR lead_score IS NOT NULL
    OR lead_score_breakdown IS NOT NULL
    OR lead_score_updated_at IS NOT NULL;

-- 5) Prospects: rating affidabilità e credit score legacy
UPDATE public.prospects
   SET rating_affidabilita = NULL,
       credit_score        = NULL
 WHERE rating_affidabilita IS NOT NULL
    OR credit_score IS NOT NULL;

COMMIT;
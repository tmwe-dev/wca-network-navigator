---
name: AI Query Planner Liberato
description: ai-query-planner usa schema vivo dal DB (RPC ai_introspect_schema, cache 5min) e system prompt minimale (~30 LOC). Niente esempi rigidi, niente regole hardcoded per enum/paesi, niente patch reattive nel client. AI decide tabella/filtri/valori vedendo lo schema reale. safeQueryExecutor valida colonne contro schema vivo.
type: feature
---
Doctrine: applicato `ai-prompt-freedom-doctrine` al Query Planner (refactor 2026-04-28).

Architettura:
- DB function `ai_introspect_schema(table_names text[])` → SECURITY DEFINER, restituisce colonne + valori enum reali, esclude colonne sensibili (user_id, raw_data, ecc.)
- `supabase/functions/_shared/liveSchemaLoader.ts` → cache 5min server-side, formatta per prompt LLM
- `src/v2/ui/pages/command/lib/liveSchemaClient.ts` → cache 5min client-side, usato da safeQueryExecutor per validare colonne
- `ai-query-planner/index.ts`: system prompt ridotto da ~170 a ~70 LOC (identità + lista tabelle con purpose + schema vivo iniettato + output JSON + vincoli hard). Eliminati: 11 esempi rigidi, mappature paesi, regole campaign_jobs.status, follow-up dettagliati.
- `aiQueryTool.ts`: rimossa `normalizeCampaignStatusPrompt`, rimosso blocco patching `if (plan.table === "campaign_jobs")`, rimosso try/catch che fabbricava tabelle vuote fittizie.

Vincoli hard restano in codice:
- ALLOWED_TABLES (whitelist 11 tabelle business)
- Solo SELECT
- Operatori whitelisted (eq/neq/gt/gte/lt/lte/ilike/in/is)
- Limit max 200
- Validazione colonne contro schema vivo (fail-open su descrittore TS legacy se RPC fallisce)

Effetto:
- Aggiungere colonna al DB → AI la vede entro 5min, zero deploy
- Aggiungere tabella → 1 riga in ALLOWED_TABLES + entry in TABLE_PURPOSE
- Cambiare valore enum → AI lo vede entro 5min
- Bug risolto: "contatti a Milano" funzionava su Command ma non su Dashboard perché schema TS era disallineato. Ora entrambi vedono lo schema reale.

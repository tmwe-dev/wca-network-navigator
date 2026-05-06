## Stato

- 1 edge function proxy (`tmwe-proxy`) con whitelist hard-coded di **6 op**
- **443 endpoint reali** documentati su `/client_api_docs`, **tutti accessibili** con i tuoi 9 scope (hai `admin`)
- **48 gruppi funzionali** (shipment_management, cargo, fatturazione, anagrafica, listini, rating_booking, crm, labels, pickups, tracking, ecc.)
- Gap: **437 endpoint non esposti** (98,6%)

## Soluzione — Whitelist dinamica DB-driven

### A. Nuova tabella `tmwe_api_catalog`
Sorgente di verità unica. Campi: `op` (es. `shipment_management.create`), `method`, `path`, `description`, `scopes` (text[]), `parameters` (jsonb), `responses` (jsonb), `group`, `risk_level` (enum `read|write|destructive|admin`), `enabled` (bool), `verified_at`, `last_called_at`. RLS: read autenticati, write service-role.

### B. Edge function `tmwe-catalog-sync`
Chiama `GET /client_api_docs` con system token, fa upsert dei 443 endpoint, calcola `risk_level` automaticamente:
- GET + scope `*:read` → **read**, `enabled=true`
- POST/PUT/PATCH non-DELETE → **write**, `enabled=true`
- DELETE → **destructive**, `enabled=false`
- gruppo `admin`/`permissions` → **admin**, `enabled=false`

Auto-popola anche `finder_api_schema_map` con role inferito (id→id_interno, awb/otp→tracking_code, data*→data, stato/status→stato, ecc.).

### C. Refactor `tmwe-proxy` + `_shared/tmweClient.ts`
Sostituire `TMWE_OPS` hard-coded con lookup su `tmwe_api_catalog`:
- valida `op` contro DB
- check `enabled` + intersezione scope token-utente
- audit log invariato
- **alias backward-compat** per i 6 nomi vecchi (`profile.me` → `profile.api_profile`, ecc.) — così `finder-api-chat` e altri caller non si rompono

### D. UI `/v2/finder-api/schema` aggiornata
- Tab **Catalog** — 443 endpoint navigabili per gruppo, badge risk, toggle `enabled`, bottone "Sync from /client_api_docs"
- Tab **Schema map** (esistente, ora auto-popolata)

### E. `finder-api-chat` aggiornato
Riceve l'elenco delle op `enabled` filtrate per gruppo rilevante alla query (non più i 6 statici).

## Default di esposizione (decisi)

- **Read (GET, 191 ep)** → enabled = **true** all'attivazione
- **Write (POST/PUT/PATCH, 213 ep)** → enabled = **true** ma flaggati `requires_confirmation` (l'agente dovrà chiedere conferma prima di chiamarli)
- **Destructive (DELETE, 39 ep)** → enabled = **false**, attivabili manualmente dalla UI Catalog
- **Admin (gruppo admin/permissions, ~18 ep)** → enabled = **false**

Backward-compat: alias mantenuti per le 6 op vecchie.

## File toccati

- Migrazione: `tmwe_api_catalog` + enum `tmwe_api_risk_level` + indici + RLS
- Nuova edge fn: `supabase/functions/tmwe-catalog-sync/index.ts`
- Refactor: `supabase/functions/_shared/tmweClient.ts` (loader DB + alias map), `supabase/functions/tmwe-proxy/index.ts`
- Refactor: `supabase/functions/finder-api-chat/index.ts` (carica catalog enabled + schema map)
- DAL: `src/data/tmweApiCatalog.ts`
- UI: `src/v2/ui/pages/finder-api/FinderApiSchemaMapPage.tsx` (Tab Catalog)

## Sequenza di esecuzione

1. Migrazione tabella + enum
2. Deploy `tmwe-catalog-sync` + prima esecuzione → popola 443 righe
3. Refactor `tmweClient.ts` + `tmwe-proxy` con alias
4. Refactor `finder-api-chat` per usare catalog enabled
5. UI Tab Catalog + bottone sync

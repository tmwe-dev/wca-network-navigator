
# Caccia al Tesoro — Audit Errori Sistemico

Obiettivo: individuare **almeno 200 problemi reali** (bug logici, riferimenti errati, variabili sbagliate, funzioni sovrapposte, istruzioni incompatibili, dead code pericoloso, drift tra moduli).

## Metodo (5 passi, sequenziali, tracciati)

### 1. Scan automatico "a rete larga" (baseline)
Raccogliere segnali statici che spesso nascondono bug:
- `tsgo` completo → errori TS nascosti
- `eslint` completo → warning + errori (234 warning noti + regole custom `no-direct-ai-invoke`, `no-direct-bulk-op`, soft-delete)
- `rg` mirati su antipattern:
  - `.single()` senza `.maybeSingle()`
  - `console.*` residui (vietati da CI)
  - `any` espliciti sopra baseline
  - `TODO|FIXME|HACK|XXX|@ts-ignore|@ts-expect-error`
  - `useEffect` con dipendenze mancanti (react-hooks/exhaustive-deps)
  - `.delete()` senza filtro soft-delete
  - `supabase.functions.invoke("<ai-fn>")` fuori da `invokeAi`
  - `process.env` in codice Deno / `Deno.env` in client
  - chiavi query hardcoded (non da `queryKeys.ts`)
  - `useState` senza tipo, `as any`, `as unknown as`
- `supabase--linter` → RLS/GRANT/policy issues
- `security--run_security_scan` → vulnerabilità
- Test suite (`vitest`) → test rossi/skippati

### 2. Diff logico cross-modulo (le "sovrapposizioni")
Confronto tra moduli che fanno lo stesso lavoro in modo diverso:
- **Motori scheduling**: `cadence` vs `outreach-scheduler` vs `smart-scheduler` vs `agent-autonomous-cycle` → dedup cross-engine
- **Classify email**: `check-inbox/postProcessing` vs `funnemail-classify` vs `classify-email-response` → chi filtra cosa
- **AI invoke**: `invokeAi` vs `aiCallShim` vs `aiGateway` vs chiamate dirette
- **Prompt assembly**: `assembler.ts` vs prompt hardcoded in edge functions
- **Resolve partner/contact**: `resolvePartnerRef` vs lookup ad-hoc in tool
- **Soft-delete**: trigger DB vs filtri client `.is('deleted_at', null)` mancanti
- **Auth guard**: JWT verify in code vs `verify_jwt = true` in config.toml
- **Cost tracking**: `costTracker` vs `llmFetchInterceptor` vs conteggi manuali
- **Intent classification**: `intentClassifier` centralizzato vs regex sparse

### 3. Deep read modulo per modulo (le zone rosse note)
Lettura riga per riga dei nodi critici già segnalati come fragili:
- `useCommandSubmit.ts` + FSM `phaseFsm.ts` + `intentClassifier.ts`
- `supabase/functions/email-cron-sync/`, `check-inbox/`, `classify-emails-batch/`
- `outreach-scheduler`, `agent-autonomous-cycle`, `agent-task-drainer`
- `pending-action-executor` (handler mancanti noti)
- `_shared/aiGateway.ts` + `aiCallHandler.ts` + fallback Gemini
- `writePayload.ts` + tool WRITE (`close-activity`, `blacklist`, `link-contact-partner`, `kb-entry`)
- `assembler.ts` + tutti i `core/*.ts` prompt
- Hook cockpit + soft-delete twin
- Auth flow TMWE (`LoginPage.tsx`, `tmwe-oauth-start`, `AuthProvider`, `AuthLifecycle`)
- MCP server edge function
- 42 file >500 LOC (monoliti candidati a bug nascosti)

### 4. Verifica incongruenze DB / runtime
- Tabelle citate in codice che non esistono in `types.ts`
- Colonne referenziate con nomi sbagliati (es. `raw_payload.direction` vs top-level `direction`)
- RLS che assume `user_id` su tabelle senza quella colonna
- GRANT mancanti su tabelle public
- Cron jobs con ordine invertito (memory-promoter vs memory_embed_backfill)
- Edge functions dichiarate ma mai chiamate (dead code)
- Tabelle `agent_personas`, `agent_routing_rules`, `prompt_test_cases` vuote malgrado layer attivo
- Agenti con 0 tool o `can_send_email=false` mentre dovrebbero avere

### 5. Log runtime (le prove ultime)
- `ai_gateway_logs` ultimi 7gg → errori 4xx/5xx, timeout, credit spike
- `supabase edge_function_logs` sulle 20 funzioni più critiche → 500/504/IDLE_TIMEOUT (già visto `batch-enrichment-worker` in timeout 150s)
- `ai_interaction_log` / `edge_metrics` → confermare telemetria on/off

## Deliverable

Un unico report `docs/audit/treasure-hunt-2026-07-19.md` con:
1. **Conteggio finale** (target ≥200, primo giro documentato)
2. **Tabella per categoria**: TS errors | ESLint | Logica | Sovrapposizioni | RLS/GRANT | Dead code | DB drift | Runtime | Perf | Security
3. Per ogni errore: `severity (P0/P1/P2/P3)`, `file:line`, `descrizione 1 riga`, `impatto`, `fix suggerito 1 riga`
4. **Top 20 P0** in cima (da fixare subito)
5. **Cluster/pattern ricorrenti** (es. "12 file usano `.single()` invece di `.maybeSingle()`")

## Regole operative durante la caccia
- Solo lettura (audit read-only). Nessuna modifica al codice in questa fase.
- Batch parallelo di `rg`/read/query dove indipendenti.
- Ogni errore deve essere **verificato** con `file:line` (no allucinazioni).
- Se il conteggio primo giro < 200, secondo giro su categorie meno esplorate (perf, a11y, i18n, edge cases).
- A fine audit propongo piano di fix ordinato per severità — nessun fix automatico.

## Cosa NON faccio in questa fase
- Non modifico file
- Non lancio migrazioni
- Non riavvio dev server
- Non "abbellisco" mentre trovo (nessun refactor opportunistico — PRINCIPIO MADRE)

Confermi e vado? Al termine ricevi il report completo con conteggio.

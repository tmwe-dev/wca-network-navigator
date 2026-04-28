## Audit dei punti che vanno toccati

Ho mappato l'intera catena della "ricerca AI" e ho trovato 7 luoghi dove la logica deve essere coerente. Oggi solo `ai-query-planner` riceverebbe il fix, gli altri 6 continuerebbero a:
- conoscere a memoria nomi tabella, paesi e label di stato (hardcoded)
- assumere che ogni risposta = 1 sola tabella
- non riuscire a commentare risposte multi-entità

| # | Punto | Problema oggi | Cosa va fatto |
|---|---|---|---|
| 1 | `supabase/functions/ai-query-planner/index.ts` | Restituisce SEMPRE 1 piano. | Output `{ plans:[...] }` (1..N), formato singolo retro-compatibile. Cap 4. |
| 2 | `src/v2/io/edge/aiQueryPlanner.ts` | Schema Zod accetta solo `QueryPlan`. | Nuovo schema `QueryPlanBatchSchema = { plans: QueryPlan[] }`, normalizza il singolo. |
| 3 | `src/v2/ui/pages/command/lib/safeQueryExecutor.ts` | `executeQueryPlan(one)`. | Aggiunge `executeQueryPlans(many)` con `Promise.allSettled`. Singolo invariato. |
| 4 | `src/v2/ui/pages/command/tools/aiQueryTool.ts` | Render solo `kind:"table"`. | Se >1 piano → nuovo `kind:"multi"` con `parts[]`. Cache `_lastSuccessfulPlan` = primo piano. |
| 5 | `src/v2/ui/pages/command/lib/localResultFormatter.ts` | Hardcoded `TABLE_NOUN_*`, `COUNTRY_LABELS`, `describeFilters`. | Aggiunge `tryLocalCommentMulti(parts)` che concatena messaggi singoli. **NON** elimino le tabelle hardcoded di label perché sono **UI niceties** (paese in italiano, plurale corretto), non knowledge sul DB — vivono già in TS perché sono testo umano. Spiego nei commenti che è UI, non schema. |
| 6 | `src/v2/ui/pages/command/hooks/useResultCommentary.ts` | Passa singolo `count` al fallback AI. | Riconosce `kind:"multi"` e chiama `tryLocalCommentMulti`; in fallback AI passa tutti i parts a `serializeResultForAI`. |
| 7 | `src/v2/ui/pages/command/components/CanvasRenderer.tsx` (via `canvasForResult`) | Non sa renderizzare multi. | Render sezioni in sequenza, header per ognuna; bulk actions disabilitate. |
| 8 | `src/v2/ui/pages/command/lib/auditFromTrace.ts` + `MessageAuditPanel` | "1 step" anche con N piani. | Mostra "N step paralleli" con tabella+durata per ognuno. |
| 9 | `src/v2/ui/pages/command/aiBridge.ts → serializeResultForAI` | Serializza solo `kind:"table"`. | Branch per `kind:"multi"` che concatena le parti. |

## Cosa NON tocco e perché

- **`ai-assistant/systemPrompt.ts`** — già KB-driven via `assemblePrompt` + Charter R5 ("chiama il tool prima di rispondere"). Le entità multiple sono già gestite dai tool (search_partners, search_contacts, get_country_stats sono separati e l'AI li invoca in sequenza/parallelo). Nessuna modifica necessaria.
- **`agent-execute/systemPrompt.ts`** — già persona/KB-driven, niente nomi tabella nel prompt. Nessuna modifica.
- **`agentic-decide`, `unified-assistant`, `agent-loop`** — orchestratori che chiamano tool, non scrivono query. Nessuna modifica.
- **Schema DB, RLS, lista tabelle whitelisted** — invariati.
- **Pipeline `plan-execution`** (multi-step sequenziale) — invariata. Questo cambio riguarda solo il fast-lane multi-entità, che è ortogonale.

## Comportamento risultante

Prompt: *"quanti address e contatti in totale abbiamo nel sistema"*
→ Planner: `plans:[{table:"partners",columns:["id"]}, {table:"imported_contacts",columns:["id"]}]`
→ Executor: 2 query in parallelo
→ Direttore: *"Nel sistema ci sono **25.103 partner** (address) e **11.414 contatti**. Vuoi filtrarli per paese o stato lead?"*
→ Audit: *"Fast lane · 2 step paralleli · driver: ai-query · 1.6s"*

Prompt singolo (es. *"quanti partner in Italia"*) → comportamento identico a oggi (regression-free).

## Test

- Unit: `aiQueryTool` path multi (2 plans, 1 fallisce → mostra il successo + errore parziale).
- Unit: `tryLocalCommentMulti` con 2 count.
- Unit: `serializeResultForAI` con `kind:"multi"`.
- E2E: `e2e/cockpit-flow.spec.ts` aggiungo step "quanti partner e contatti" → assert messaggio contiene entrambi i numeri.

## Deploy

Solo `ai-query-planner` da deployare (le altre modifiche sono client-side).

## Nota sulla "uniformità di prompt"

La tua osservazione era giusta in generale, ma in questo specifico cambio gli **altri** system prompt (ai-assistant, agent-execute) **non** hanno bisogno di patch perché:
1. non producono query SQL, chiamano tool;
2. i tool sono già **per-entità** (`search_partners`, `search_contacts` ecc.) quindi l'AI può già invocarli in parallelo se serve.

La "stessa filosofia" qui significa togliere knowledge hardcoded sul DB nei punti dove ce n'è — e il punto è il **planner + i suoi consumatori**, non gli altri orchestratori che già passano dai tool.

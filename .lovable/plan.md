

## Problema rilevato

L'utente ha ragione: il sistema attuale "imbocca" l'AI con tool hardcoded (`partnerSearch`, `scanWcaDirectory`, `contactSearch`, ecc.) che contengono già:
- Il nome esatto della tabella (`partners`)
- Il campo da filtrare (`country_code`)
- Le mappe di traduzione (es. `"stati uniti" → "US"`)
- Le query pre-confezionate

Questo annulla il valore dell'AI: invece di ragionare su schema e dati, esegue solo dispatcher deterministici. L'AI deve invece **conoscere lo schema** e **generare query** autonomamente.

## Esplorazione fatta

- `src/v2/ui/pages/command/tools/` contiene ~12 tool hardcoded, ognuno con la sua logica di parsing/filtro.
- `src/v2/ui/pages/command/aiBridge.ts` chiama `decideToolFromPrompt` → l'AI sceglie un tool da una lista chiusa, non scrive query.
- Edge function `ai-assistant` modalità `tool-decision` riceve solo `{id, label, description}` dei tool: zero conoscenza dello schema DB.
- Esistono già schemi Zod (`src/v2/io/supabase/schemas/partner-schema.ts`) e DAL (`src/v2/io/supabase/queries/`) — riusabili come "esecutori sicuri" delle query AI.
- Le tabelle business sono ~80 (partners, contacts, prospects, outreach_queue, download_jobs, ecc.) con RLS già attivo.

## Strategia: AI-Native Query Engine

Sostituisco l'attuale architettura "tool-dispatcher" con una "AI Query Engine" in 4 livelli:

```text
┌─────────────────────────────────────────────────────┐
│ 1. PROMPT UTENTE                                    │
│    "mostra partner US attivi con rating > 4"        │
└──────────────────┬──────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────┐
│ 2. AI QUERY PLANNER (edge: ai-query-planner)        │
│    Input: prompt + SCHEMA KB (tabelle/colonne/RLS)  │
│    Output: { table, filters, sort, limit, columns } │
└──────────────────┬──────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────┐
│ 3. SAFE EXECUTOR (client-side)                      │
│    - Whitelist tabelle business                     │
│    - Whitelist operatori (eq, gt, ilike, in, ...)   │
│    - Cap limit a 200                                │
│    - Esegue via supabase.from() rispettando RLS     │
└──────────────────┬──────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────┐
│ 4. CANVAS RENDERER                                  │
│    L'AI sceglie kind (table/cards/result) e         │
│    propone bulkActions in base ai dati restituiti   │
└─────────────────────────────────────────────────────┘
```

## Cosa elimino

- `partnerSearch.ts`, `scanWcaDirectory.ts`, `contactSearch.ts`, `prospectSearch.ts`, `deepSearchPartner.ts` e tutti i tool "search-like" hardcoded.
- Le mappe `COUNTRY_MAP` / `STOPWORDS` / `MATCH_KEYWORDS` (la traduzione semantica la fa l'AI).
- Il dispatch `tool.match(prompt)` per i tool di sola query.

## Cosa creo

1. **Schema KB** (`src/v2/agent/kb/dbSchema.ts`): descrizione machine-readable di ~15 tabelle business core (nome, scopo, colonne chiave, valori enum, esempi). Iniettata nel system prompt del planner.
2. **Edge `ai-query-planner`**: riceve prompt + schema KB + history → ritorna JSON `QueryPlan` validato Zod.
3. **`safeQueryExecutor.ts`** (client): valida il `QueryPlan` (whitelist tabelle/operatori/colonne), esegue via Supabase SDK, ritorna righe + count.
4. **Tool unico `aiQueryTool.ts`**: rimpiazza tutti i tool di ricerca. Match generico (default per qualsiasi prompt che non sia azione esplicita). Esegue planner → executor → renderer.
5. **Tool d'azione restano** (outreach, enrich, score, scan-jobs): sono operazioni con side-effect, qui l'AI sceglie il tool, non genera query libere.

## File toccati

**Nuovi:**
- `src/v2/agent/kb/dbSchema.ts` — descrittore tabelle
- `src/v2/ui/pages/command/tools/aiQueryTool.ts` — tool unico AI-native
- `src/v2/ui/pages/command/lib/safeQueryExecutor.ts` — esecutore whitelistato
- `src/v2/io/edge/aiQueryPlanner.ts` — client edge
- `supabase/functions/ai-query-planner/index.ts` — edge function

**Modificati:**
- `src/v2/ui/pages/command/tools/registry.ts` — rimuove i 5 tool hardcoded, registra `aiQueryTool` come fallback principale
- `src/v2/ui/pages/command/aiBridge.ts` — passa schema KB al planner quando il tool scelto è `ai-query`
- `src/v2/ui/pages/command/hooks/useGovernance.ts` — permesso `READ:DB` per `ai-query`

**Eliminati:**
- `tools/partnerSearch.ts`, `tools/scanWcaDirectory.ts`, `tools/contactSearch.ts`, `tools/prospectSearch.ts`, `tools/deepSearchPartner.ts`

## Sicurezza (non negoziabile)

- Solo `SELECT` (no insert/update/delete dal planner).
- Whitelist tabelle business in `safeQueryExecutor` (no `auth.*`, no `user_roles`, no `secrets`).
- Whitelist operatori: `eq, neq, gt, gte, lt, lte, ilike, in, is`.
- Cap limit hard 200, default 50.
- RLS Supabase resta l'ultima difesa (l'utente vede solo ciò a cui ha accesso).
- Se il planner produce JSON invalido o tabella non whitelisted → fallback a errore "Riformula la richiesta".

## Estetica preservata

Zero modifiche a canvas, gradient, badge LIVE, framer-motion, LiveActivityRail, bulk-action bar. Il tool AI-native restituisce lo stesso `ToolResult` shape (`kind: "table" | "cards" | "result"`).

## Verifica post-implementazione

1. `tsc --noEmit` pulito.
2. Smoke prompt: "mostra partner US attivi con rating > 4", "contatti senza email", "ultimi 20 prospect aggiunti". Ognuno deve produrre query diverse senza tool dedicati.
3. Test sicurezza: prompt malevolo "elimina tutti i partner" → planner deve rifiutarsi (solo SELECT) o l'executor deve bloccare.
4. Unit test `safeQueryExecutor`: whitelist enforcement.


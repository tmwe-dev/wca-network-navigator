# Armonizzatore V2 — Implementazione

Pipeline agentica entity-by-entity che sostituisce il sistema a chunk fisso. Risolve token overflow, perdita di proposte, duplicati cross-chunk e fragilità dei retry.

## Architettura

5 stadi: **Parse** (client) → **Compact Index** (DB metadati) → **Agent Loop** (Match → Retrieve → Reason → Validate → Retry) → **Orchestrator** → **Self-Review**.

Ogni entità = una micro-call AI (~2K input / ~300 output token). Impossibile overflow. Failure granulare per entità invece che per chunk intero.

## Fase 0 — Fix bloccanti (preliminari)

1. **Verifica `systemPrompt.ts` riga 14-22**: il branch `conversational + operatorBriefing` esiste già da fix precedente. Confermare via log che il payload da `callHarmonizer` includa `operatorBriefing`. Se manca, fix lato chiamante.
2. **`scopeConfigs.ts`**: aggiungere `max_tokens?: number` all'interfaccia `ScopeConfig`. Impostare `max_tokens: 16000` nel case `kb-supervisor`.
3. **`aiCallHandler.ts`**: propagare `max_tokens` e `temperature` da scope config a `makeAiCall`.
4. Deploy `ai-assistant`.

## Fase 1 — Infrastruttura (nuova directory `harmonizer-v2/`)

**`entityParser.ts`** — Splitta il documento su heading markdown (#, ##, ###).
- **Fence-aware**: skip righe dentro code block ```` ``` ```` (condizione bloccante).
- Riusa `inferCategory` e `readMeta` da `harmonizeCollector.ts`.
- Output: `EntityToParse[]` con `id` (hash sha256 troncato di title+table), `title`, `content`, `inferredTable`, `sourceLineStart/End`.
- Ignora sezioni con body < 50 char.

**`compactIndex.ts`** — Query DB parallele su 6 tabelle target (`kb_entries`, `operative_prompts`, `email_prompts`, `email_address_rules`, `commercial_playbooks`, `agent_personas`).
- Solo metadati: `id`, `title/name`, `category`, `contentLength`. Zero contenuti.
- Output: `CompactIndex` con `entries[]`, `byTable: Map`, `byTitle: Map` (lowercase normalizzato).
- Dimensione attesa: ~5KB per ~200 entry.

## Fase 2 — Agent core

**`entityMatcher.ts`** — Scoring multi-candidato (zero AI):
- Match esatto titolo (100/60 same-table/cross-table)
- Match parziale contenimento (70/40)
- Match per parole chiave ≥4 char, ≥2 in comune (50/30)
- Top 3 candidati ordinati per score.

**`entityRetriever.ts`** — Fetch on-demand del contenuto completo solo per i match selezionati. Query raggruppate per tabella. Cache in-memory dentro l'orchestrator (suggerimento approvato: dedup tra entità che matchano stessi entry).

**`agentRules.ts`** — System prompt compatto (~400 token). Output JSON strutturato con: `decision`, `confidence`, `reasoning`, `proposal`, `extracted_facts`, `conflict`.

**`agentReasoner.ts`** — Build prompt per entità + retry adattivo:
- Validazione Zod + coherence check (UPDATE senza match → invalid; INSERT con match esatto → invalid; confidence <0.3 con non-SKIP → invalid).
- 3 strategie retry: `simplify` → `explicit_match` → `decompose`. Dopo fallimento: SKIP graceful con `needsHumanReview: true`.

**`ai-gateway-micro` (nuova edge function)** — Endpoint minimale che bypassa context assembly, doctrine, memoria.
- Input: `{ model, system, user, max_tokens, temperature }`.
- **Sicurezza non negoziabile**: JWT verify (`requireAuth` da `_shared/authGuard.ts`), CORS dinamico (`getCorsHeaders` da `_shared/cors.ts`), security headers.
- Modello default: `google/gemini-2.5-flash`.

## Fase 3 — Orchestratore + UI

**`agentOrchestrator.ts`** — `runAgenticHarmonizer(input)`:
- Stadio 0+1 → crea `HarmonizerSession` con bootstrap entities dall'index.
- Loop entità: Match → Retrieve (con cache) → Reason+Retry → Commit (proposal + facts + conflicts) → aggiorna `sessionState.recentDecisions` (ultimi 5) e `entitiesCreated`.
- **Persistenza progress** (suggerimento approvato): salvare `last_processed_entity_index` in `harmonizer_sessions` per resume after crash. Richiede colonna nuova (migration).
- Stadio 4: `selfReview` → warnings (duplicate inserts, insert rate >80%, items needing review).

**`useAgenticHarmonizer.ts`** — Hook React con stato `AgenticProgress` (phase, current/total, lista entità con status individuali, stats, warnings).

**`HarmonizeSystemDialog.tsx`** — Switch del tab "Ingestione documento" al nuovo hook. UI: progress bar globale + lista scrollabile per entità con badge colore (UPDATE verde, INSERT blu, SKIP grigio, NEEDS REVIEW giallo) + stats finali.

## Fase 4 — Cleanup

File deprecati (rimossi solo dopo verifica end-to-end v2):
- `tmweChunks.ts`, `harmonizerLibraryCollector.ts`, `harmonizerLibraryAnalyzer.ts`, `harmonizerKbInjector.ts`, `useHarmonizerLibraryIngestion.ts`.

File preservati (usati da "Migliora tutto"):
- `harmonizeAnalyzer.ts`, `harmonizeCollector.ts` (per `inferCategory` e `parseDesiredInventoryDetailed`).

## Migration DB

Una sola migration:
```sql
ALTER TABLE harmonizer_sessions
  ADD COLUMN last_processed_entity_index integer DEFAULT 0;
```

## Test di accettazione

1. Parser su TMWE → 60-100 entità, zero crash, zero entità con body vuoto, code block ignorati correttamente.
2. Compact Index → ~200 entry, tutte le 6 tabelle presenti, dimensione <10KB.
3. 10 entità di test → zero "UPDATE senza match", zero "INSERT con match esatto".
4. Pipeline completa TMWE → insert rate <80%, warning self-review se sopra.
5. Retry: entità con JSON invalido viene ritentata e supera con strategia diversa.
6. Resume: kill browser a entità #45 → restart riprende da #45.

## Stima realistica

14-18h di lavoro distribuite nelle 4 fasi (Fase 0: 30min, Fase 1: 2-3h, Fase 2: 4-5h, Fase 3: 4-5h, Fase 4: 1h, test e fix: 2-3h).

## Rischio regressione

**Zero**. Tutti i nuovi file in directory separata `harmonizer-v2/`. "Migliora tutto" intatto. Unico file esistente toccato: `HarmonizeSystemDialog.tsx` per switchare hook.
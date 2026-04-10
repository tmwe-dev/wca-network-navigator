

# Test Gap Analysis — Da 7/10 a 10/10

## Stato Attuale

| Area | Copertura | Voto |
|---|---|---|
| Unit test Vitest (src/test/) | 660 test, 54 file — buona | 8/10 |
| Integration test Deno (edge functions) | 44 test, 8 funzioni su 66 | 4/10 |
| Component test (.test.tsx) | 0 componenti testati | 0/10 |
| E2E Playwright | 12 spec, ma 7 hanno il test principale `skip` | 3/10 |
| Hook/Context test | 0 | 0/10 |

---

## I 6 Gap che Mancano per il 10/10

### GAP 1 — 58 Edge Functions senza integration test
Solo 8 funzioni su 66 hanno integration test. Le piu critiche senza copertura:

**Priorita alta (core business):**
- `voice-brain-bridge` — appena riscritto, zero test
- `elevenlabs-conversation-token` — appena riscritto, zero test
- `ai-assistant` — cuore del sistema AI
- `super-assistant` — assistente enterprise
- `process-download-job` — download contatti WCA
- `stripe-webhook` — pagamenti
- `deep-search-partner` / `deep-search-contact` — enrichment
- `extension-brain` — bridge estensioni browser
- `memory-promoter` — promozione memoria AI
- `kb-embed-backfill` — backfill embedding RAG

**Priorita media:**
- `import-assistant`, `contacts-assistant`, `cockpit-assistant`
- `enrich-partner-website`, `analyze-partner`
- Tutte le funzioni `save-*-cookie`, `get-*-credentials`

### GAP 2 — Zero component test React
Nessun componente UI ha un test dedicato `.test.tsx`. I monoliti piu critici:
- `FiltersDrawer` (1300 LOC)
- `BusinessCardsHub` (1084 LOC)
- `AddContactDialog` (794 LOC)
- `ImportWizard` (625 LOC)
- `AgentVoiceCall` — appena modificato
- `EmailEditLearningDialog` — appena fixato

### GAP 3 — Zero hook/context test
Nessun test per:
- `useAgents`, `usePartners`, `useEmailDrafts`
- `ActiveOperatorContext`, `ContactDrawerContext`
- Custom hooks di fetch/mutation

### GAP 4 — E2E quasi tutti `skip`
7 spec su 12 hanno il test principale skippato. Servono:
- Login helper riutilizzabile (fixture Playwright)
- Almeno 5 flussi E2E reali non-skip

### GAP 5 — Nessun test per il sistema di apprendimento
Il ciclo Memory/KB/RAG appena fixato non ha test:
- `save_memory` tool → verifica insert in `ai_memory`
- `save_kb_rule` tool → verifica insert + embedding auto
- `ragSearchKb` → verifica retrieval semantico
- `memory-promoter` → verifica promozione L1→L2→L3
- Feedback buttons → verifica boost/reduce confidence

### GAP 6 — Nessun test per bridge_tokens (nuovo)
La tabella `bridge_tokens` e il flusso token-per-sessione appena creati non hanno:
- Test di creazione token + hash validation
- Test di scadenza (token expired → 401)
- Test di cleanup token usati

---

## Piano di Implementazione (prioritizzato)

### Step 1: Integration test per le 10 edge function critiche
Creare `index.integration.test.ts` per: `voice-brain-bridge`, `elevenlabs-conversation-token`, `ai-assistant`, `super-assistant`, `stripe-webhook`, `deep-search-partner`, `extension-brain`, `memory-promoter`, `kb-embed-backfill`, `process-download-job`.
Pattern: CORS preflight + 401 senza auth + error shape.

### Step 2: Test sistema apprendimento (Vitest)
Nuovo file `src/test/ai-learning-system.test.ts`:
- Simulazione ciclo memory save/retrieve/promote/decay
- Validazione embedding auto-trigger dopo save_kb_rule
- Validazione scale confidence (sempre 0-1)
- RAG fallback behavior quando embedding manca

### Step 3: Test bridge_tokens (Vitest + Deno)
- Vitest: logica hash, scadenza, validazione
- Deno integration: `voice-brain-bridge` con token valido/scaduto/mancante

### Step 4: Component test per i 4 monoliti + 2 appena modificati
- `AgentVoiceCall.test.tsx` — render, start/stop, token flow
- `EmailEditLearningDialog.test.tsx` — render, submit, confidence value
- `FiltersDrawer.test.tsx` — render, filtri base
- `ImportWizard.test.tsx` — render, step navigation

### Step 5: Hook/Context test
- `useAgents.test.ts`, `usePartners.test.ts`
- `ActiveOperatorContext.test.tsx`

### Step 6: E2E login fixture + unskip 5 test
- Creare `e2e/fixtures/auth.ts` con login riutilizzabile
- Unskippare: `email-inbound-to-task`, `campaign-queue-lifecycle`, `agent-approval-flow`, `queue-ui-state-consistency`, `followup-mission`

---

## Stima

- Step 1: ~10 file, ~50 test Deno
- Step 2: ~1 file, ~15 test Vitest
- Step 3: ~2 file, ~10 test
- Step 4: ~6 file, ~25 test React
- Step 5: ~3 file, ~15 test
- Step 6: ~6 file, ~15 test reali

**Totale: ~130 nuovi test**, portando il sistema da ~704 a ~834 test con copertura completa su tutti i layer.

### Raccomandazione
Iniziare da Step 1 + Step 2 + Step 3 (le aree appena modificate). Sono i piu urgenti perche coprono codice nuovo senza alcun test.


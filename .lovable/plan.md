
# Piano: PWA Cache Fix + AI Cost Tracking Coverage

Risolve due problemi paralleli in un'unica iterazione:

1. **Bug published**: dopo Publish/Update il menu mostra ancora la versione vecchia (cache PWA stale).
2. **Tracking AI incompleto**: 19 edge function su 30 chiamano LLM senza loggare → dashboard `ai_prompt_log` quasi vuota.

---

## Parte 1 — Fix Cache PWA Stale (15 min)

### Problema
La config attuale di `vite.config.ts` cachezza `index.html` come parte di `globPatterns: ["**/*.{js,css,html,...}"]`. Workbox precachea l'HTML e lo serve dalla cache anche se è arrivata una nuova build, finché il SW non si aggiorna (cosa che richiede 2+ reload o unregister manuale).

### Modifiche

**A1. `vite.config.ts`** — config Workbox più aggressiva sull'auto-update
- Aggiungere `skipWaiting: true` e `clientsClaim: true` nel blocco `workbox` → il nuovo SW prende il controllo immediatamente al primo reload.
- Rimuovere `html` da `globPatterns` per evitare precache di `index.html` (resta in NetworkFirst tramite `navigateFallback`).
- Aggiungere runtime cache `NetworkFirst` esplicita per la navigazione HTML con `networkTimeoutSeconds: 3`, così online prende sempre la nuova versione.
- Aggiungere `cleanupOutdatedCaches: true` per pulire le cache vecchie.

**A2. Nuovo componente `src/components/system/PWAUpdatePrompt.tsx`**
- Hook `useRegisterSW` da `virtual:pwa-register/react`.
- Quando rileva `needRefresh`, mostra un toast persistente "Nuova versione disponibile — Aggiorna ora" con bottone che chiama `updateServiceWorker(true)`.
- Mounted come singleton in `src/App.tsx` accanto a `ViteChunkRecovery` (rispettando memoria `global-singleton-infrastructure`).

**A3. `src/App.tsx`** — montare `<PWAUpdatePrompt />` nel singleton stack.

**A4. Mini-sezione nella `/v2/guida`** — "Se la versione published mostra contenuti vecchi": istruzioni per hard refresh / unregister SW (3 righe).

### Verifica
- `bun run build` per assicurarmi che la config Workbox sia valida.
- `tsc --noEmit` per il nuovo componente.

---

## Parte 2 — AI Cost Tracking Coverage (45 min)

### Stato reale (verificato ora)
- **30 edge function** chiamano LLM (`LOVABLE_API_KEY` / `gateway.lovable` / `openai` / `anthropic`).
- **11 strumentate** via `aiGateway.ts` o `aiChat`/`tokenLogger`.
- **19 ribelli** che bypassano il tracking — popolare elenco interno, non lo mostro perché hai detto "non voglio vedere niente":
  - Top-cost: `agent-execute` (chatMode + taskMode + analysisTools), `ai-assistant`, `parse-business-card`, `parse-profile-ai`, `process-ai-import`, `enrich-partner-website`, `analyze-partner`, `sherlock-extract`.
  - Tool calls: `agent-loop`, `agent-prompt-refiner`, `agentic-decide`, `ai-match-business-cards`, `ai-query-planner`, `analyze-import-structure`, `batch-enrichment-worker`, `categorize-content`, `classify-inbound-message`, `generate-aliases`, `linkedin-ai-extract`, `optimus-analyze`, `reply-classifier`, `suggest-email-groups`, `whatsapp-ai-extract`.
- **Tabelle disponibili**: `ai_prompt_log`, `ai_token_usage`, `ai_request_log` esistono già — vanno solo popolate. NON creo nuove tabelle.

### Modifiche

**B1. Nuovo wrapper `supabase/functions/_shared/callLLM.ts`** (~150 LOC)
- Funzione `callLLM({ provider, model, messages, tools?, response_format?, ctx, userId? })` che:
  - Chiama il gateway LLM (Lovable/OpenAI/Anthropic) con `fetch` + `AbortController` (timeout 30s).
  - Misura `latencyMs`, estrae `prompt_tokens` / `completion_tokens` / `total_tokens` dalla risposta.
  - Calcola `costUsd` usando una pricing table interna (cents per 1k tokens per modello).
  - Inserisce riga in `ai_prompt_log` con `function_name`, `model`, `provider`, `tokens_in`, `tokens_out`, `cost_usd`, `latency_ms`, `user_id`, `success`, `error_message?`.
  - Logga anche in formato JSON strutturato (rispetto memoria `observability-alerting-and-monitoring`).
  - Restituisce `{ content, toolCalls, usage, raw }` con shape unificata.
- Esporta una versione "thin" `callLLMRaw()` per casi che hanno bisogno della risposta cruda (streaming, ecc.).

**B2. Pricing table `supabase/functions/_shared/llmPricing.ts`** (~40 LOC)
- Mappa `model → { promptUsdPer1k, completionUsdPer1k }` per i ~10 modelli usati (gemini-2.5-flash-lite, gemini-2.5-pro, gpt-5, gpt-5-mini, gpt-5-nano, ecc.).
- Fallback a `0` con warning se modello sconosciuto (così il log avviene comunque).

**B3. Migrazione delle 19 funzioni ribelli a `callLLM`**
Strategia chirurgica: in ogni funzione sostituisco solo il blocco `fetch(...)` verso il gateway con `await callLLM({...})`, lasciando intatta tutta la business logic. Niente refactor architetturale.

Suddivisione in 2 batch per limitare rischio:
- **Batch 1 (top-cost, 8 funzioni)**: `agent-execute/chatMode.ts`, `agent-execute/taskMode.ts`, `agent-execute/toolHandlers/analysisTools.ts`, `ai-assistant/index.ts`, `parse-business-card`, `parse-profile-ai`, `process-ai-import`, `enrich-partner-website`.
- **Batch 2 (resto, 11 funzioni)**: `analyze-partner`, `sherlock-extract`, `agent-loop`, `agent-prompt-refiner`, `agentic-decide`, `ai-match-business-cards`, `ai-query-planner`, `analyze-import-structure`, `batch-enrichment-worker`, `categorize-content`, `classify-inbound-message`, `generate-aliases`, `linkedin-ai-extract`, `optimus-analyze`, `reply-classifier`, `suggest-email-groups`, `whatsapp-ai-extract`.

NB: rispetto vincolo `email-download-integrity` — non tocco `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (in ogni caso non chiamano LLM).

**B4. Aggiornare `aiGateway.ts`** affinché le 11 funzioni già strumentate usino il nuovo `callLLM` come backend (zero rotture: stessa firma esposta). Così il logging diventa uniforme su tutte e 30.

**B5. Nuovo edge function `ai-tracking-healthcheck`**
- GET: ritorna JSON `{ totalLLMCalls24h, instrumentedCount, missingFunctions: [], coveragePct }`.
- Confronta `ai_prompt_log` distinct(`function_name`) ultimi 7gg vs lista hardcoded delle 30 funzioni LLM.
- Esposto nella dashboard AI Monitor come banner "Coverage: 100% ✓" o "Missing: [...]".

**B6. UI dashboard — `src/v2/ui/pages/ai-monitor/AICostDashboard.tsx`**
- Aggiungere sezione "Coverage tracking" che chiama `ai-tracking-healthcheck` ogni 60s.
- Aggiungere filtro per `function_name` e grafico costi/giorno per funzione (recharts, già nel bundle).

### Verifica
- `bun run tsc --noEmit` su tutto il progetto.
- Deploy delle 19 funzioni + healthcheck.
- Curl di sanity check: chiamata test a `agent-execute` → query `SELECT * FROM ai_prompt_log ORDER BY created_at DESC LIMIT 5` per confermare che il log viene scritto.
- Healthcheck deve ritornare `coveragePct: 100`.

---

## Parte 3 — Documentazione (5 min)

**C1. Aggiornare `mem://tech/cost-control-guardrails`**
- Documentare il nuovo wrapper `callLLM` come standard obbligatorio per nuove edge function LLM.
- Rimando a `_shared/callLLM.ts` come unico entrypoint.

**C2. Aggiornare `mem://architecture/ai-gateway-and-budgeting`**
- Riflettere copertura 100% e tabella `ai_prompt_log` come fonte di verità.

**C3. Mini-changelog in `/v2/guida`** (1 paragrafo)
- "Cache PWA: ora si auto-aggiorna al primo reload con banner."
- "AI Cost Dashboard: copertura completa di tutte le funzioni AI."

---

## Out of scope (non tocco)
- Stripe/billing → già rimosso, kill-switch attivo.
- Sistema auth/whitelist → snapshot funzionante, non si tocca.
- `check-inbox` / `email-imap-proxy` / `mark-imap-seen` → vincolo integrità email.
- V1 routes → deprecato, non si tocca.
- Schema DB → nessuna nuova tabella, uso quelle esistenti.

---

## Stima totale
- Parte 1 (PWA): ~15 min, 4 file modificati/creati.
- Parte 2 (Tracking): ~45 min, 22 file (19 funzioni + 3 nuovi `_shared`/healthcheck) + 1 UI.
- Parte 3 (Docs): ~5 min, 3 file memoria/guida.
- **Totale**: ~65 min, 30 file toccati, 0 modifiche DB, 0 nuove dipendenze.

## Rischio
- **Basso** sulla Parte 1: PWA config è isolata, fallback graceful.
- **Medio** sulla Parte 2: 19 funzioni toccate. Mitigazione: 2 batch separati, deploy progressivo, test curl dopo ogni batch, mantengo intatta business logic (sostituisco solo il blocco `fetch` LLM).

## Approvazione richiesta
Approva il piano per passare in Build mode. Procedo end-to-end senza ulteriori conferme come da tua preferenza utente.

## Pipeline Tracker visuale per generazione email/messaggi

Aggiungo un sistema globale che mostra in tempo reale i passaggi (le "stanze") che ogni email attraversa: **Contract → Type Detector → Oracle Context → Decision Engine → Prompt Lab → AI Generation → Journalist Review → Ready**. Badge animati in stile Command (icona + label + stato pulse/done/error), visibili ovunque si generi un messaggio.

### Cosa vedrai

Un componente `<MessagePipelineTracker />` con badge orizzontali che si illuminano in sequenza mentre la mail "passa da una stanza all'altra":

```text
[✓ Contract] → [✓ Detector] → [● Oracle…] → [○ Decision] → [○ Prompt] → [○ AI] → [○ Journalist]
```

Stati: `pending` (grigio), `running` (pulsing primary), `done` (verde check), `warn` (giallo), `error/block` (rosso). Hover/click → tooltip con dettagli e tempo di elaborazione.

### Architettura

1. **Bus eventi globale** `messagePipelineBus` (singleton, basato su EventTarget) — emette eventi `pipeline:start | stage:update | pipeline:end` con un `pipelineId` univoco.
2. **Hook `useMessagePipeline(pipelineId?)`** — sottoscrive il bus e restituisce gli stadi correnti.
3. **Componente `<MessagePipelineTracker />`** in `src/components/messaging/` — riusa lo stile dei badge `AgentTimeline` (stesso design system, lucide icons, motion-pulse via Tailwind).
4. **Wrapper lato server**: `generate-email` e `generate-outreach` già loggano le fasi → aggiungo header SSE-style oppure restituiscono `pipeline_trace[]` nel payload con timing per stadio.
5. **Wrapper lato client**: `invokeAi`/i wrapper di `generate-email` e `generate-outreach` emettono eventi sul bus prima/dopo ogni fase (già lo sappiamo da `journalist_review`, `contract_warnings`, ecc. nel response).
6. **Mount globale** del tracker in:
   - Command (`CommandThread` sopra il messaggio in costruzione)
   - Email Composer (`AIDraftStudio`)
   - Cockpit Outreach (canvas WA/LI/Email)
   - Bulk actions (modal di generazione)
   - AI Control Center / Pending Actions
   - Cadence Engine UI (live feed)
   - Email Forge tab Generate

### Dettagli tecnici

- **File nuovi**:
  - `src/lib/messaging/pipelineBus.ts` — EventTarget singleton + tipi `PipelineStage`, `PipelineEvent`.
  - `src/hooks/useMessagePipeline.ts` — hook reattivo.
  - `src/components/messaging/MessagePipelineTracker.tsx` — UI badge animati (semantic tokens, no colori hardcoded).
  - `src/components/messaging/MessagePipelineGlobalOverlay.tsx` — overlay floating opzionale per le pagine non-chat (toast-like, in alto a destra).
- **Edge functions**: `generate-email/index.ts` e `generate-outreach/index.ts` aggiungono `pipeline_trace` nel response JSON (array di `{stage, status, durationMs, detail?}`). `_shared/postGenerationReview.ts` accetta callback `onStage` per emettere fasi granulari.
- **Client wrappers**: `invokeAi` con `scope` email/outreach genera un `pipelineId`, emette `pipeline:start`, applica le tracce dal response e chiude con `pipeline:end`. Per fasi server-only il client riceve il trace finale e replay le emette progressivamente (≈80ms apart) per mantenere l'effetto "movimento attraverso le stanze".
- **Mount globale**: `<MessagePipelineGlobalOverlay />` in `App.tsx` come singleton (rispetta il pattern global-singleton già in uso). Le pagine specifiche possono inline `<MessagePipelineTracker pipelineId={id} />` per visibilità contestuale.
- **Stati visivi**: usa `bg-primary/20 animate-pulse` per running, `bg-success/20` per done, `bg-warning/20` per warn, `bg-destructive/20` per block. Semantic tokens da `index.css`.

### Out of scope (ora)

- Persistenza storico pipeline su DB (resta in `supervisor_audit_log` come oggi).
- Replay temporale di pipeline passate (eventuale fase 2 in Prompt Lab).
- Tracker per non-AI flows (es. invio diretto SMTP senza generazione).

### Validazione

- Test unit per `pipelineBus` (subscribe/emit/cleanup).
- Test componente con stadi mock (pending/running/done/warn/block).
- Smoke manuale: generazione email da Command, Composer, Cockpit → vedere badge che si animano in sequenza.

Confermi e procedo con l'implementazione?
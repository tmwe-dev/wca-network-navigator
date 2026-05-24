# Migrazione totale AI → chiavi OpenAI dell'utente

## Obiettivo
Far sì che **tutte** le edge function (44 file) usino la tua chiave OpenAI (`OPENAI_API_KEY`) invece del gateway Lovable AI (`LOVABLE_API_KEY`). Risultato: il budget AI Lovable smette di essere consumato.

> Nota importante: questo **non** risolve l'avviso "Cloud & AI balance esaurito" sul lato infrastruttura (DB + runtime edge function). Quel budget va comunque ricaricato perché copre l'esecuzione delle funzioni stesse e il database. Le tue chiavi sostituiscono solo l'inferenza AI.

## Strategia: shim drop-in, niente refactor

Tocchiamo **un solo file nuovo** e **una riga per ciascuna delle 44 function**.

### Fase 1 — Nuovo helper `_shared/aiCallShim.ts`

Espone una funzione `aiGatewayFetch(body, options)` che:

1. Se `AI_PROVIDER === "openai"` e `OPENAI_API_KEY` presente → POST a `https://api.openai.com/v1/chat/completions` con `Authorization: Bearer ${OPENAI_API_KEY}`.
2. Mappa automaticamente il modello richiesto (`google/gemini-3-flash-preview`, `openai/gpt-5-mini`, ecc.) sull'equivalente OpenAI (`gpt-4o-mini`, `gpt-4o`, ecc.) riusando `MODEL_MAP` di `aiGatewayConfig.ts`.
3. Rimuove campi non supportati da OpenAI (es. `reasoning`).
4. Fallback al gateway Lovable solo se `AI_PROVIDER` non è impostato (back-compat per ambienti dev).
5. Risposta sempre nello stesso formato (compatibile OpenAI/Lovable già lo è).

Vantaggio: ogni call-site cambia di 2 righe. Nessuna modifica al flusso, ai prompt, ai tool, alla telemetria, ai retry o all'editorial review.

### Fase 2 — Sostituzione meccanica nelle 44 function

Per ogni file della lista, si sostituisce il pattern:

```ts
const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model, messages, ... }),
});
```

con:

```ts
import { aiGatewayFetch } from "../_shared/aiCallShim.ts";
const resp = await aiGatewayFetch({ model, messages, ... });
```

File interessati (44, raggruppati per area):

- **Agenti / orchestrazione**: `agent-execute/*`, `agent-loop`, `agent-simulate`, `agent-prompt-refiner`, `agentic-decide`, `super-mario/*`, `optimus-analyze`
- **Email / outreach**: `generate-aliases`, `harmonize-proposal-chat`, `prompt-copilot-chat`, `suggest-email-groups`, `learn-from-group-correction`, `refine-classification-rule`
- **Funnemail**: `funnemail-auto-route`, `funnemail-classify`, `funnemail-scout-sender`, `simulate-funnemail-classify`, `run-funnemail-eval`
- **Classificazione inbound**: `classify-inbound-content`, `classify-inbound-message/stages/stageClassifyAi`, `whatsapp-ai-extract`, `refresh-conversation-context`
- **Enrichment / scraping**: `analyze-partner`, `enrich-partner-website`, `batch-enrichment-worker`, `analyze-import-structure`, `process-ai-import`, `parse-business-card`, `ai-match-business-cards`, `parse-profile-ai`, `sherlock-extract`, `kb-intake-analyze`, `categorize-content`
- **Altro**: `finder-api-chat`, `prompt-test-runner`, `health-check`, `ai-assistant/memoryContextLoader`, `_shared/messageCompression`

### Fase 3 — Verifica

1. `bun run typecheck` (CI già attiva).
2. Deploy delle function modificate.
3. Smoke test su 3 endpoint critici: `ai-assistant`, `generate-email`, `classify-email-response`.
4. Lettura log: nessun errore `LOVABLE_API_KEY 402`, presenza di `api.openai.com` nei log gateway.

## Cosa NON cambia

- Editorial review (`journalistReview`) resta obbligatorio e identico.
- Tool whitelist, hard guards, prompt sanitizer, injection guard restano intatti.
- Telemetria (`edge_metrics`, `ai_interaction_log`) continua a registrare con lo stesso schema.
- I prompt operativi non vengono toccati.
- Nessuna modifica al frontend.

## Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Modello mappato su OpenAI con costi diversi | `MODEL_MAP.openai` già definito (gemini-flash → gpt-4o-mini, gemini-pro → gpt-4o) |
| Campi specifici (`reasoning`, `safety_settings`) rifiutati da OpenAI | Lo shim li droppa silenziosamente |
| Function in `email-imap-proxy`/`check-inbox`/`mark-imap-seen` | Non toccate (memoria di progetto le protegge) |
| Tool-calling format leggermente diverso | OpenAI è il riferimento del formato Lovable AI → nessuna differenza pratica |
| Rate limit OpenAI sulla tua chiave | Lo shim propaga 429/402 con lo stesso codice attuale, niente regressioni |

## Tempi stimati

- Fase 1 (shim): 1 step.
- Fase 2 (44 file): 1 sweep parallelo.
- Fase 3 (verifica): smoke test + log.

Totale: una singola sessione, end-to-end senza chiedere conferme intermedie (come da preferenze utente).

## Prerequisito già soddisfatto

- `AI_PROVIDER=openai` ✅
- `OPENAI_API_KEY` valida ✅ (già corretta nella sessione precedente)

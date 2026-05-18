# Migrazione AI: da Lovable Gateway a Anthropic + OpenAI + Google con routing configurabile

## Obiettivo
Spostare tutte le chiamate AI dall'AI Gateway di Lovable verso le API native dei tre provider di cui hai gli account (Anthropic, OpenAI, Google Gemini), con possibilità di scegliere **per scope** il modello da usare direttamente da una pagina di configurazione, senza redeploy.

## Architettura proposta

```text
                Frontend (invokeAi + scope)
                          |
                          v
              Edge function (qualsiasi)
                          |
                          v
           _shared/aiGateway.aiChat({scope, models})
                          |
              +-----------+------------+
              v                        v
    routing_rules DB              MODEL_MAP fallback
    (scope -> provider+model)
              |
              v
    +---------+---------+---------+----------+
    v                   v         v          v
 Anthropic            OpenAI    Google    Lovable* (solo embeddings opt)
 ANTHROPIC_API_KEY    OPENAI    GEMINI    (fallback emergenze)
```

*Embeddings: OpenAI `text-embedding-3-small` (Anthropic non li offre).

## Strategia di mapping costo/complessità

Tier per scegliere il modello giusto in base al lavoro che fa lo scope:

| Tier | Quando | Modello consigliato | Costo indicativo (1M tok in/out) |
|------|--------|---------------------|----------------------------------|
| **HEAVY** | Agent loop, multi-tool reasoning, journalist review finale, classify-inbound-message complesso, sherlock-extract, ai-assistant principale | `claude-sonnet-4-5` (Anthropic) | $3 / $15 |
| **STANDARD** | Generate-email, generate-outreach, improve-email, refine-classification-rule, agentic-decide, ai-query-planner, prompt-copilot-chat | `gpt-4o` (OpenAI) o `claude-haiku-4-5` se costo critico | $2.50/$10 — $1/$5 |
| **LIGHT** | suggest-email-groups, categorize-content, classify-inbound-content, learn-from-group-correction, summarize, generate-aliases, parse-business-card (text), kb-intake-analyze | `gemini-2.5-flash` (Google) | $0.075/$0.30 |
| **VISION** | parse-business-card OCR, ai-match-business-cards, linkedin-ai-extract, whatsapp-ai-extract con immagini | `gemini-2.5-flash` (multimodale, ottimo prezzo/qualità) | $0.075/$0.30 |
| **EMBEDDINGS** | KB, memoria, RAG, doctrine audit | `text-embedding-3-small` (OpenAI) | $0.02/1M tok |

Tutti i valori sono **default proposti** — modificabili dalla pagina di config senza redeploy.

## Cosa cambia tecnicamente

### 1. Secrets (via tool secrets)
Aggiungo: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`.
`LOVABLE_API_KEY` resta solo come fallback emergenza (puoi disattivarlo dopo aver verificato che tutto gira).

### 2. Nuova tabella `ai_routing_config` (DB)
```text
scope text PRIMARY KEY      -- es. "agent_loop", "generate_email", "classify_inbound"
provider text NOT NULL      -- 'anthropic' | 'openai' | 'google'
model text NOT NULL         -- es. 'claude-sonnet-4-5'
tier text                   -- 'heavy' | 'standard' | 'light' | 'vision' (documentazione)
notes text
updated_at, updated_by
```
RLS: lettura per tutti gli autenticati, scrittura solo admin.
Seedata con i default della tabella sopra (uno scope per ogni edge function AI).

### 3. Refactor `_shared/aiGateway.ts`
- `aiChat({ scope, ... })` legge `ai_routing_config` (con cache in-memory 60s) e risolve provider+model.
- Se scope non in tabella -> usa MODEL_MAP esistente come fallback.
- Rimuovo l'hard-coded `AI_PROVIDER` env e i nomi `claude-sonnet-4-20250514` errati.
- Aggiorno `MODEL_MAP` Anthropic ai nomi reali (`claude-sonnet-4-5`, `claude-haiku-4-5`).
- Aggiorno `MODEL_MAP` Google ai nomi reali (`gemini-2.5-flash`, `gemini-2.5-pro`).
- Header auth Anthropic: aggiungo `x-api-key` + `anthropic-version: 2023-06-01`.

### 4. Bonifica bypass gateway (~5 file)
Porto tutte le funzioni elencate sotto a usare `aiChat()`:
- `ai-gateway-micro/index.ts` — wrapper diretto, lo riconverto
- `whatsapp-ai-extract`, `parse-business-card`, `funnemail-classify`, `linkedin-ai-extract` — chiamate dirette a `ai.gateway.lovable.dev`
- `ai-assistant/aiProviderResolver.ts` — riallineato al nuovo router; mantiene BYOK utente come override

### 5. Embeddings (`_shared/embeddings.ts`)
Switch da Lovable AI a `https://api.openai.com/v1/embeddings` con `text-embedding-3-small` (1536 dim — stessa dimensione delle pgvector columns attuali, **nessuna migrazione vettoriale necessaria**). Verifico con un check rapido sui pgvector columns esistenti prima di confermare.

### 6. Pagina di configurazione
Nuova route `/v2/settings/ai-routing` (admin only):
- Tabella scope x (provider, model) con dropdown
- Pulsanti "Reset to defaults", "Test scope" (chiama l'edge `ai-gateway-micro` con il modello selezionato e mostra latenza/costo stimato)
- Badge tier (Heavy/Standard/Light/Vision) accanto a ogni riga
- Storico modifiche (chi/quando)

### 7. Osservabilità
`structuredLogger` già logga `provider` e `model` — aggiungo `scope` e `cost_estimate_usd` per riga in `edge_metrics`, così vedi i costi reali per scope in dashboard.

## Cosa NON cambia
- Frontend `invokeAi()` — già astratto, zero modifiche
- `ai_scope_registry`, `journalistReview`, prompt sanitizer, injection guard, prompt versioning, hard guards
- Logica di business delle edge function (solo lo strato di trasporto AI)
- BYOK utente (`user_api_keys`) — resta come override per utente avanzato

## Piano di rilascio (atomico, reversibile)
1. **Fase 1** — Migrazione DB (tabella `ai_routing_config` + seed default) — *reversibile (drop table)*
2. **Fase 2** — Refactor `aiGateway.ts` + nuovo resolver, fallback a MODEL_MAP intatto — *reversibile (env `AI_PROVIDER=lovable` riattiva path vecchio)*
3. **Fase 3** — Bonifica 5 funzioni con bypass — *reversibile (git revert per file)*
4. **Fase 4** — Switch embeddings a OpenAI — *NON reversibile vettorialmente se cambia dim; pre-check obbligatorio*
5. **Fase 5** — Pagina `/v2/settings/ai-routing` admin
6. **Fase 6** — Smoke test su 6 scope chiave (`generate-email`, `agent-loop`, `classify-inbound-message`, `parse-business-card`, `suggest-email-groups`, `ai-assistant`) tramite `curl_edge_functions`

## Domande residue (rispondo io con default se non specifichi)
- **Pagina config**: la metto sotto `/v2/settings` o preferisci nel Prompt Lab?
- **Lovable Gateway**: lo rimuovo del tutto o lo lascio come provider opzionale per emergenze?
- **Test scope**: vuoi anche stima costo nella UI (ti calcolo $/1k token in base ai prezzi pubblici di ogni provider)?

Se non rispondi a queste, vado con: `/v2/settings/ai-routing`, Lovable rimosso da MODEL_MAP ma codice provider conservato in PROVIDER_CONFIG (toggle disabilitato), stima costo inclusa.

## Vincoli rispettati
- Memoria progetto: nessuna modifica a `check-inbox`, `email-imap-proxy`, `mark-imap-seen`, journalist review, hard guards
- AI Invocation Charter: ogni scope continua a passare da `invokeAi()` con `ai_scope_registry`
- DAL only, no `any`, `.maybeSingle()`, env per secrets — tutto preservato
- Soft-delete, RLS, CORS whitelist — non toccati

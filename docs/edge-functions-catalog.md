# Edge Functions Catalog

Generato automaticamente — 2026-08-06 — do NOT edit a mano.
Esegui `node scripts/gen-edge-catalog.mjs` per rigenerare.

**Totale: 149 funzioni** — 14 con `verify_jwt=false`.

| # | Funzione | JWT | Descrizione |
|---|----------|-----|-------------|
| 1 | `agent-audit` | ✅ on | agent-audit — Per-agent diff: DB-controlled (Prompt Lab) vs hardcoded (code). READ-ONLY. For each active agent returns:   - persona:       D |
| 2 | `agent-autonomous-cycle` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 3 | `agent-autopilot-worker` | ✅ on | agent-autopilot-worker — Cron-invoked (every 10 min) edge function. Advances active autopilot missions: checks KPI/budget, invokes agent-loo |
| 4 | `agent-execute` | ✅ on | ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ |
| 5 | `agent-loop` | ✅ on | agent-loop edge function — One iteration of the agent loop. Receives goal + history, returns AI decision with tool_calls. |
| 6 | `agent-prompt-refiner` | ✅ on | agent-prompt-refiner — Weekly cron that analyzes feedback and proposes prompt improvements for active agents. Suggestions go to ai_pending_a |
| 7 | `agent-simulate` | ✅ on | agent-simulate — Prompt Lab simulator. Given { agentId, userMessage, sessionContext?, dryRunAI? } returns the EXACT prompt assembly that age |
| 8 | `agent-task-drainer` | ✅ on | agent-task-drainer — Cron-invoked (every 5 min) edge function. Drains pending agent_tasks by invoking agent-execute per task. Behavior per t |
| 9 | `agentic-decide` | ✅ on | agentic-decide — l'AI legge il contesto attuale dell'indagine e decide:   - quali URL visitare nei prossimi step (max 3 alla volta)   - se f |
| 10 | `ai-arena-suggest` | ✅ on | ai-arena-suggest/index.ts — Suggests never-contacted partners for the AI Arena. |
| 11 | `ai-assistant` | ✅ on | ai-assistant/index.ts — Main orchestrator Coordinates: auth → mode dispatch → context assembly → AI calls → tool loops → response |
| 12 | `ai-backup` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 13 | `ai-deep-search-helper` | ✅ on | ai-deep-search-helper — server-side wrapper per chiamate AI Gateway leggere usate dal Deep Search client (useDeepSearchLocal). Vol. II §6.2  |
| 14 | `ai-gateway-micro` | ✅ on | ai-gateway-micro — Endpoint minimale per micro-call AI dell'Armonizzatore V2. BYPASSA: context assembly, doctrine, memoria, tool, scope conf |
| 15 | `ai-match-business-cards` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 16 | `ai-monitor` | ✅ on | ai-monitor — Aggregated AI cost dashboard endpoint. GET /ai-monitor (with auth): returns:  - todayTotal, monthTotal, weekTotal (period total |
| 17 | `ai-query-planner` | ✅ on | ai-query-planner — Genera un QueryPlan strutturato da un prompt utente. Input:  { prompt: string, history?: {role,content}[] } Output: { tab |
| 18 | `ai-test-runner` | ✅ on | ai-test-runner — Esegue scenari di test (ai_test_scenarios) contro qualsiasi edge function AI del sistema, applica assertion e ritorna il ri |
| 19 | `ai-tracking-healthcheck` | ✅ on | ai-tracking-healthcheck — Verifica copertura tracking AI cost. Confronta funzioni LLM dichiarate vs funzioni che hanno effettivamente loggat |
| 20 | `ai-utility` | ✅ on | ai-utility — Macro-function for lightweight AI utilities. Routes by body.action: briefing | categorize | deep_search |
| 21 | `analyze-email-edit` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 22 | `analyze-import-structure` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 23 | `analyze-partner` | ✅ on | esm.sh/@supabase/supabase-js@2' |
| 24 | `apply-classification-insight` | ✅ on | Applica un'insight approvata: append dell'hint al gruppo bersaglio (oppure al prompt operativo "Email Groups Classifier"). Hard guard: solo  |
| 25 | `apply-email-rules` | ✅ on | apply-email-rules — Esegue le regole email_address_rules sui messaggi appena scaricati. Strategia: UNA sola connessione IMAP TLS, login, com |
| 26 | `backfill-email-rules` | ✅ on | backfill-email-rules — Applica le regole IMAP a messaggi STORICI già presenti sul server di posta (non solo ai nuovi arrivi). Strategia: una |
| 27 | `batch-enrichment-worker` | ✅ on | Batch Enrichment Worker — arricchisce automaticamente i partner senza enrichment_data. Eseguito ogni 30 minuti via pg_cron. - Pesca N partne |
| 28 | `browser-action` | ✅ on | browser-action — Headless browser actions via Browserless/Playwright. Executes sequential actions (navigate, click, type, screenshot, etc.)  |
| 29 | `cadence-engine` | ✅ on | cadence-engine — Cron-triggered engine for processing scheduled follow-up actions. Runs hourly, checks trigger conditions, and creates/execu |
| 30 | `calculate-lead-scores` | ✅ on | calculate-lead-scores — Batch lead scoring Edge Function. Calculates a numeric lead_score for all imported_contacts based on data completene |
| 31 | `calculate-partner-quality` | ✅ on | calculate-partner-quality/index.ts Edge function per il calcolo automatico del Partner Quality Score. Richiamato dopo: |
| 32 | `categorize-content` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 33 | `check-external-db` | ✅ on | dlldkrzoxvjxpgkkttxu.supabase.co"; |
| 34 | `check-inbox` | ✅ on | check-inbox/index.ts — Thin orchestrator. Imports from: imapConnection, messageProcessor, postProcessing. |
| 35 | `check-inbox-booking` | ✅ on | check-inbox-booking/index.ts — Copia esatta di check-inbox dedicata ESCLUSIVAMENTE alla casella aziendale booking@tmwe.it (server mx01.vmtec |
| 36 | `classify-emails-batch` | ✅ on | classify-emails-batch — Cron fallback per inbound non classificati. Trova channel_messages.direction='inbound' senza riga in reply_classific |
| 37 | `classify-inbound-content` | ✅ on | classify-inbound-content — Strato 2 del classificatore inbound. Legge il CONTENUTO della mail con contesto pieno (mittente, history, holding |
| 38 | `classify-inbound-message` | ✅ on | classify-inbound-message — Universal inbound message classifier (email, whatsapp, linkedin). Invoked by pg_net from on_inbound_message trigg |
| 39 | `command-ask-brain` | ✅ on | command-ask-brain — Bridge ElevenLabs Command Agent ↔ Brain (ai-assistant scope=command) Chiamato dall'Agente Vocale ElevenLabs come client  |
| 40 | `confirm-injection-review` | ✅ on | confirm-injection-review — Edge function per approvare/rifiutare un prompt sospetto rilevato dal guard anti-injection. POST body: |
| 41 | `consume-credits` | ❌ off | Kill-switch: per uso interno aziendale i crediti sono disattivati. Riattivare in scenario commerciale settando AI_USAGE_LIMITS_ENABLED=true. |
| 42 | `country-kb-generator` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 43 | `daily-briefing` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 44 | `decision-dashboard` | ✅ on | decision-dashboard — Edge function per Decision Engine + Approval Flow. Endpoints (via query param `action`):   - evaluate: valuta un partne |
| 45 | `deduplicate-contacts` | ✅ on | esm.sh/@supabase/supabase-js@2.49.1"; |
| 46 | `deduplicate-partners` | ✅ on | deduplicate-partners — Finds and merges duplicate partner records. Groups partners by normalized company_name + country_code, identifies dup |
| 47 | `dispatch-integrity-check` | ✅ on | dispatch-integrity-check — Audit coherence of executed pending actions. For each ai_pending_actions with status='executed' in the last 72h,  |
| 48 | `dispatch-urgent-alert` | ✅ on | dispatch-urgent-alert — Invio autonomo di alert WhatsApp ai responsabili configurati in `alert_recipients` per messaggi inbound classificati |
| 49 | `elevenlabs-conversation-token` | ✅ on | elevenlabs-conversation-token Issues a short-lived WebRTC conversation token for the ElevenLabs Conversational Agent used by Command (hybrid |
| 50 | `elevenlabs-tts` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 51 | `email-cron-sync` | ✅ on | Email Cron Sync — runs every 10 minutes via pg_cron. Mailbox-aware: itera per (user_id, mailbox_id) leggendo da `email_sync_state` e auto-is |
| 52 | `email-delivery-webhook` | ❌ off | email-delivery-webhook (P3.1) Webhook handler per eventi di delivery email da provider esterni (SMTP relay, ESP come Postmark/SendGrid/SES). |
| 53 | `email-imap-proxy` | ✅ on | esm.sh/@supabase/supabase-js@2"; |
| 54 | `email-sync-worker` | ✅ on | Email Sync Worker — server-side autonomous email download. Called by pg_cron every minute (or manually). Finds running sync jobs, invokes ch |
| 55 | `enrich-partner-website` | ✅ on | esm.sh/@supabase/supabase-js@2"; |
| 56 | `export-audit-csv` | ✅ on | export-audit-csv edge function — Exports agent_action_log as CSV. |
| 57 | `finder-api-chat` | ✅ on | finder-api-chat — Conversational AI for the Finder API page. Read-only conversational agent that translates natural-language queries into TM |
| 58 | `funnemail-auto-route` | ✅ on | funnemail-auto-route — Auto-instradamento mail nei gruppi mittente dell'utente. Si attiva fire-and-forget da classify-inbound-message dopo l |
| 59 | `funnemail-backfill-inbound` | ✅ on | funnemail-backfill-inbound — Riprocessa retro-attivamente le inbound non classificate degli ultimi N giorni invocando `funnemail-classify` p |
| 60 | `funnemail-classify` | ✅ on | funnemail-classify — Classifica un'email inbound nelle cartelle del client Funnemail e decide azione, agenda, handoff commerciale. La logica |
| 61 | `funnemail-policy-engine` | ✅ on | funnemail-policy-engine — Sprint 3. Risolve la policy effettiva (per-user override → group default) per un messaggio inbound già classificat |
| 62 | `funnemail-policy-executor` | ✅ on | funnemail-policy-executor — Sprint 3. Esegue UNA singola azione (action_type) in modo idempotente. Hard guards:  - draft_reply / autorespond |
| 63 | `funnemail-reminders-tick` | ✅ on | funnemail-reminders-tick Cron tick (1 min) che marca i reminder Funnemail come "due" e registra una riga in `funnemail_actions_log` (action= |
| 64 | `funnemail-scout-sender` | ✅ on | funnemail-scout-sender — Scout livello 1 sul mittente di una email inbound. Logica:  1. Estrae il dominio dall'indirizzo email. |
| 65 | `funnemail-send-autoresponder` | ✅ on | Funnemail Autoresponder — Template-only acknowledgment sender. ECCEZIONE APPROVATA AL JOURNALIST REVIEW: Questo è un invio di sola NOTIFICA  |
| 66 | `generate-aliases` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 67 | `generate-content` | ✅ on | generate-content — Macro-function for all content generation. Routes by body.action: email | outreach | improve | analyze_edit |
| 68 | `generate-email` | ✅ on | generate-email/index.ts — Orchestrator (~120 LOC). Delegates to contextAssembler, promptBuilder, responseParser. |
| 69 | `generate-outreach` | ✅ on | generate-outreach/index.ts — Orchestrator (~100 LOC). Delegates to contextAssembler, promptBuilder, responseParser. |
| 70 | `get-linkedin-credentials` | ❌ off | esm.sh/@supabase/supabase-js@2' |
| 71 | `get-ra-credentials` | ❌ off | esm.sh/@supabase/supabase-js@2' |
| 72 | `get-wca-credentials` | ❌ off | esm.sh/@supabase/supabase-js@2' |
| 73 | `harmonize-proposal-chat` | ✅ on | harmonize-proposal-chat Chat persistente tra l'operatore umano e l'agente Curatore (Gordon) su una specifica proposta di armonizzazione. |
| 74 | `health-check` | ❌ off | health-check — System health probe with 9 semaphore checks. Returns structured { status, checks, timestamp } consumed by SystemHealthDashboa |
| 75 | `imap-list-folders` | ✅ on | — |
| 76 | `improve-email` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 77 | `install-vault-service-role-key` | ✅ on | One-shot bootstrap + verifier. |
| 78 | `kb-doctrine-audit` | ✅ on | kb-doctrine-audit — Snapshot + audit della Knowledge Base. Produce un report (markdown + jsonb) salvato in `kb_audit_reports`. NON modifica  |
| 79 | `kb-embed-backfill` | ✅ on | kb-embed-backfill — genera/aggiorna embedding per le KB entries che ne sono prive. Vol. II §11 (RAG architecture) — pipeline di indexing. In |
| 80 | `kb-index-map` | ✅ on | Edge function: kb-index-map Read-only. Restituisce una mappa navigabile della Knowledge Base:  - aggregazione per famiglia canonica (6) + de |
| 81 | `kb-ingest-document` | ✅ on | kb-ingest-document — Ingester end-to-end per documenti caricati dall'utente. Pipeline: Upload (base64) → Estrazione testo → Chunking → Embed |
| 82 | `kb-intake-analyze` | ✅ on | Edge function: kb-intake-analyze Riceve nuovo materiale (paste/url/file content) e propone:  - categoria + chapter + titolo + tags + priorit |
| 83 | `kb-promoter` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 84 | `kb-supervisor` | ✅ on | kb-supervisor — Audit della Knowledge Base e dei Prompt. Verifica struttura (Livello 1), coerenza (Livello 2), allineamento strategico (Live |
| 85 | `learn-from-group-correction` | ✅ on | learn-from-group-correction Quando l'operatore sceglie un gruppo diverso dal suggerimento AI, questa function: |
| 86 | `linkedin-ai-extract` | ✅ on | P1.5 — Hardened auth: require a real JWT (or anon-key from a CORS-whitelisted |
| 87 | `linkedin-profile-api` | ✅ on | P1.5 — Auth required: Proxycurl is paid + per-request billed. |
| 88 | `list-elevenlabs-voices` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 89 | `log-action` | ✅ on | log-action — Edge function per tracciare side-effect post-invio da client-side (WhatsApp, LinkedIn, SMS, invii manuali). LOVABLE-93: Sostitu |
| 90 | `manage-email-folders` | ✅ on | manage-email-folders — IMAP folder operations (move, archive, spam, list, create). Performs IMAP operations on email folders AFTER emails ha |
| 91 | `mark-imap-seen` | ✅ on | esm.sh/@supabase/supabase-js@2"; |
| 92 | `mcp` | ✅ on | AUTO-GENERATED by @lovable.dev/mcp-js — do not edit. Regenerated by the Vite plugin. |
| 93 | `memory-embed-backfill` | ✅ on | memory-embed-backfill — genera/aggiorna embedding per le ai_memory entries che ne sono prive. Input opzionale (JSON body):   { batchSize?: n |
| 94 | `memory-promoter` | ✅ on | Generate embeddings for memory rows that lack them |
| 95 | `mission-executor` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 96 | `optimus-analyze` | ✅ on | optimus-analyze — Optimus Scraper Agent Analizza il DOM di pagine WhatsApp/LinkedIn e genera un piano di estrazione dinamico, con cache per  |
| 97 | `outreach-scheduler` | ✅ on | outreach-scheduler — Cron-invoked edge function that processes pending outreach schedules. Pattern: SELECT FOR UPDATE SKIP LOCKED, batch 20, |
| 98 | `parse-business-card` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 99 | `parse-profile-ai` | ✅ on | esm.sh/@supabase/supabase-js@2' |
| 100 | `pending-action-executor` | ✅ on | pending-action-executor — Executes approved ai_pending_actions by type. Routes:  send_email       → invoke send-email |
| 101 | `process-ai-import` | ✅ on | process-ai-import — AI-powered contact import enrichment Edge Function. Takes an import_log_id, fetches pending imported_contacts, and uses  |
| 102 | `process-download-job` | ✅ on | Download job progress tracker. NO HTTP requests to WCA — the frontend + Chrome Extension handle all scraping. This function only manages job |
| 103 | `process-email-queue` | ✅ on | esm.sh/@supabase/supabase-js@2"; |
| 104 | `process-inbound-enrichment` | ✅ on | process-inbound-enrichment — Worker batch per la coda `inbound_enrichment_queue`. Esegue per ogni mail di mittente sconosciuto:  1. Chiamata |
| 105 | `prompt-copilot-chat` | ✅ on | Edge function: prompt-copilot-chat Chat AI ↔ KB del Prompt Reader. **Non scrive** mai sui prompt attivi: produce solo proposte (testo nuovo  |
| 106 | `prompt-registry-drift-check` | ✅ on | prompt-registry-drift-check Audit Funnemail Cr6 / audit esterno Gap 5 — Prompt registry drift. Per ogni voce di EDGE_FN_REGISTRY confronta i |
| 107 | `prompt-test-runner` | ✅ on | prompt-test-runner — Esecuzione test di regressione per i prompt operativi. Fase 1 della roadmap audit AI (vedi `docs/audit/ai-architecture- |
| 108 | `recalculate-partner-quality` | ✅ on | recalculate-partner-quality — Batch recalculation of Partner Quality Scores. LOVABLE-93: Edge function for TASK 1 (auto-calculate after enri |
| 109 | `receive-channel-message` | ✅ on | receive-channel-message — Webhook per estensioni browser. L'estensione invia messaggi inbound (WA/LI) ricevuti, che vengono inseriti in chan |
| 110 | `record-e2e-run` | ✅ on | record-e2e-run Webhook chiamato dal workflow GitHub Actions `e2e-nightly` per archiviare il riepilogo del run. |
| 111 | `refine-classification-rule` | ✅ on | Refiner: quando l'utente sceglie un gruppo diverso dal suggerimento AI, analizza un campione di email del mittente e propone una modifica di |
| 112 | `refresh-conversation-context` | ✅ on | refresh-conversation-context — Builder/refresher del riassunto relazione contatto. Idempotente, debounced, fire-and-forget friendly. Legge g |
| 113 | `replay-domain-events` | ❌ off | replay-domain-events — Cross-request domain event replay engine. RESPONSABILITÀ:   Replays unprocessed domain events from the domain_events  |
| 114 | `response-pattern-aggregator` | ✅ on | Response Pattern Aggregator Analyzes email response patterns and aggregates them into response_patterns table. Generates kb_entries for high |
| 115 | `review-message` | ✅ on | review-message — Editorial gate per WhatsApp e LinkedIn dal cockpit. I send manuali WA/LI sono client-side (postMessage → estensione), quind |
| 116 | `run-funnemail-eval` | ✅ on | run-funnemail-eval — Esegue uno o più funnemail_eval_cases contro la pipeline di classificazione corrente (riproducendo la fase AI di classi |
| 117 | `save-correction-memory` | ✅ on | save-correction-memory — Persists user corrections as L1 memories for the continuous learning loop. |
| 118 | `save-linkedin-cookie` | ❌ off | esm.sh/@supabase/supabase-js@2' |
| 119 | `save-linkedin-credentials` | ✅ on | FIX G3 — Server-side encryption endpoint for LinkedIn email/password. |
| 120 | `save-ra-cookie` | ❌ off | esm.sh/@supabase/supabase-js@2' |
| 121 | `save-ra-prospects` | ❌ off | esm.sh/@supabase/supabase-js@2' |
| 122 | `save-wca-contacts` | ✅ on | Pick best email matching person's name |
| 123 | `save-wca-cookie` | ❌ off | Save WCA cookie to app_settings. ZERO HTTP requests to WCA — only checks cookie content locally. This prevents IP-mismatch session invalidat |
| 124 | `scrape-website` | ✅ on | Filtra il payload completo in base ai blocchi richiesti dal chiamante. Cache shared tra chiamanti con include diversi: salviamo sempre full, |
| 125 | `send-email` | ✅ on | Idempotency key — if provided, a successful send with the same key + recipient is returned cached (no double-send) and a failed one is recor |
| 126 | `send-linkedin` | ✅ on | REGOLA TASSATIVA: LinkedIn operations must NEVER exceed: - 50 messaggi al giorno (HARD LIMIT, no exceptions) - 3 messaggi all'ora |
| 127 | `send-whatsapp` | ✅ on | send-whatsapp — Queues a WhatsApp message for dispatch via browser extension. Architecture: NO official API. Messages are queued in extensio |
| 128 | `sherlock-extract` | ✅ on | sherlock-extract — Edge function che usa Lovable AI (gemini-3-flash-preview) per estrarre findings strutturati da un markdown già scrapato.  |
| 129 | `simulate-funnemail-classify` | ✅ on | simulate-funnemail-classify — Read-only dry-run del flusso di classificazione inbound. Replica gli stage chiave di `classify-inbound-message |
| 130 | `smart-scheduler` | ✅ on | smart-scheduler — Daily cron that proposes auto-scheduled follow-ups. Analyzes stale contacts and hot leads, creates ai_pending_actions for  |
| 131 | `suggest-email-groups` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 132 | `super-mario` | ✅ on | super-mario — AI Gateway unificato per il Command (e altri scope futuri). Pipeline:   1. Auth + parse body |
| 133 | `sync-business-cards` | ✅ on | esm.sh/@supabase/supabase-js@2.49.4"; |
| 134 | `sync-wca-partners` | ✅ on | esm.sh/@supabase/supabase-js@2.49.4"; |
| 135 | `tmwe-catalog-sync` | ✅ on | tmwe-catalog-sync — sincronizza il catalogo dei 443 endpoint TMWE Findair leggendo /client_api_docs con il system token e popolando `tmwe_ap |
| 136 | `tmwe-customer-sync` | ✅ on | tmwe-customer-sync — Aggiorna snapshot anagrafica + fatturato 12 mesi. Modalità:  - single: { mode:"single", tmwe_client_id } richiesto da U |
| 137 | `tmwe-disconnect` | ✅ on | tmwe-disconnect — Rimuove la connessione TMWE per l'operatore corrente. |
| 138 | `tmwe-oauth-callback` | ❌ off | tmwe-oauth-callback — Endpoint pubblico chiamato da TMWE dopo login operatore. Scambia il `code` per access/refresh token, recupera il profi |
| 139 | `tmwe-oauth-start` | ❌ off | tmwe-oauth-start — Crea state CSRF e restituisce l'URL di autorizzazione TMWE. La UI fa redirect a `redirect_url`. Nessun token viene mai es |
| 140 | `tmwe-partner-link` | ✅ on | tmwe-partner-link — Crea il collegamento partner ⇄ cliente TMWE e triggera la sync del singolo cliente. |
| 141 | `tmwe-partner-match` | ✅ on | tmwe-partner-match — Cerca candidati cliente TMWE per un partner Lovable. Identity: user (OAuth operatore). Strategia: 1) match esatto P.IVA |
| 142 | `tmwe-proxy` | ✅ on | tmwe-proxy — Unico canale di uscita verso TMWE Findair. Il client invoca { op, params, identity? } dove `op` deve essere presente nella whit |
| 143 | `tmwe-quote-lookup` | ✅ on | tmwe-quote-lookup — Calcola tariffa per un partner usando il listino TMWE assegnato. |
| 144 | `translate-text` | ✅ on | translate-text — Edge function di traduzione email/short text. USO TIPICO  - Bulk send: tradurre lo stesso oggetto+corpo nella lingua del de |
| 145 | `tts` | ✅ on | deno.land/std@0.168.0/http/server.ts"; |
| 146 | `unified-assistant` | ✅ on | unified-assistant — Single entry point for all assistant scopes. Routes all scopes to ai-assistant (the main engine with platform tools). Ph |
| 147 | `voice-brain-bridge` | ✅ on | voice-brain-bridge — Webhook ElevenLabs ↔ Brain WCA Auth: per-session bridge token (hash-validated) OR legacy shared secret. User ID: resolv |
| 148 | `wca-country-counts` | ✅ on | esm.sh/@supabase/supabase-js@2.49.4"; |
| 149 | `whatsapp-ai-extract` | ❌ off | deno.land/std@0.168.0/http/server.ts"; |

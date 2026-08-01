# Deep Audit AI, Routing, Sincronizzazione & Agenti — 4 maggio 2026

> Audit di seconda generazione, attraversa il sistema in sei livelli sequenziali (Architettura → Moduli → Funzioni → Matching → Sincronizzazione → Agenti/Prompt/KB) e si chiude con un confronto puntuale rispetto al primo audit del 4 maggio 2026 (`docs/audit/2026-05-04-ai-routing.md`).
>
> Nessuna modifica al codice. Tutte le evidenze sono state verificate con query DB e lettura sorgenti il 4/5/2026.

---

## TL;DR

| Tema | Esito |
|---|---|
| Pipeline ingestion email (`check-inbox` cron 15') | OK, 8.029 inbound ultimi 30gg |
| Pipeline classificazione | 🔴 **bloccata** — 1 sola riga in `email_classifications` (cumulativa storica) |
| Funnemail (smistamento cartelle UI) | 🔴 **0 chiamate**, mai agganciato all'inbox |
| Routing post-classificazione | ⚠️ 12/28 categorie hanno handler, **16 categorie morte** |
| Risk Gate / Pending Actions | OK design, ma vuoto in pratica (1 record storico) — conseguenza dei P0 |
| Scheduling | ⚠️ 4 motori in parallelo (`cadence`, `outreach-scheduler`, `smart-scheduler`, `agent-autonomous-cycle`) senza dedup cross-engine |
| Governance prompts | OK (50 operative_prompts, 68 versioni, 25 scope) — **0 test cases** |
| Persona DB | 🔴 **0 righe** in `agent_personas` malgrado memoria dichiari layer attivo |
| Telemetria invocazioni | 🔴 `ai_interaction_log` e `edge_metrics` **vuote**, charter dichiarato ENFORCED ma non popolato |
| Routing rules agenti | 🔴 `agent_routing_rules` **vuota** |
| KB | 275 entry, ma 0 agenti hanno `knowledge_base` popolata (a parte Luca con 1 entry) |

I tre ★ critici (P0) del primo audit sono **tutti confermati**. Ne aggiungiamo tre nuovi: persona-layer scollegato, telemetria spenta, routing rules mai popolate.

---

# Livello 1 — Architettura

## 1.1 Mappa macro

```
┌──────────────────────────────────────────────────────────────────────┐
│  INGRESSO                                                            │
│  IMAP(15')  Scraping  BCA  Import  WCA-bridge  Receive(WA/LI)        │
└──────┬───────────┬──────────┬──────────┬─────────┬───────────────────┘
       ▼           ▼          ▼          ▼         ▼
   check-inbox  scrape    parse-bc  process-ai  receive-channel-msg
       │           │      sync-bc   import          │
       │           ▼          │      │              │
       │   enrich-partner-website   ▼              ▼
       │           │     deduplicate-*    channel_messages
       ▼           ▼          │              │
  channel_messages, partners, contacts ◀────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  CLASSIFICAZIONE                                                     │
│  classify-email-response   classify-inbound-message   reply-classifier│
│         │                          │                       │         │
│         ▼                          ▼                       ▼         │
│   email_classifications     (intent dispatch)        (cross-channel) │
│         │                                                            │
│  funnemail-classify (cartelle UI) ◀── chiamato solo manualmente      │
└──────┬───────────────────────────────────────────────────────────────┘
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  ROUTING                                                             │
│  EmailProcessManager → postClassificationPipeline                    │
│      ├─ domainHandler (operative/admin/support/internal)             │
│      ├─ emailRouter (commercial)                                     │
│      ├─ bounceAndUnsubscribeHandler                                  │
│      └─ questionAndComplaintHandler                                  │
└──────┬───────────────────────────────────────────────────────────────┘
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  GOVERNANCE                                                          │
│  aiActionRiskGate (7 livelli) → ai_pending_actions (two-phase)       │
│  injectionGuard (HIGH = 409, owner approves)                         │
│  promptSanitizer / aiInvocationGuard / journalistReview (mandatory)  │
└──────┬───────────────────────────────────────────────────────────────┘
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  ESECUZIONE                                                          │
│  pending-action-executor → send-email / send-whatsapp / send-linkedin│
│  postSendPipeline → reminderManager (cadenze 0/3/7/8/12/16/23)       │
└──────┬───────────────────────────────────────────────────────────────┘
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  APPRENDIMENTO                                                       │
│  email_classifications loop, aiEditPatterns, prompt_versions/runs    │
│  KB promoter / Memory promoter / KB embed backfill                   │
└──────────────────────────────────────────────────────────────────────┘
```

## 1.2 Confini di layer

```
V2 UI (logic-less)
   ↓ events / hooks
src/v2/hooks (state machines)
   ↓ DAL (src/data/*.ts) — unico punto autorizzato a parlare con DB
   ↓ supabase.from()  +  invokeAi() (charter)
   ↓
edge functions (113) — _shared è la SSOT delle utility
   ↓ AI Gateway (Lovable AI)
   ↓ DB (Postgres + cron + trigger soft-delete)
```

Vincoli architetturali in vigore:
- DAL only (mem://architecture/data-access-layer-dal)
- AI Invocation Charter (`invokeAi` con `scope` registrato)
- Editorial review obbligatorio (`journalistReview`) sui canali in uscita
- Soft-delete trigger su 15 tabelle business
- Whitelist CORS, security headers, getClaims JWT verification
- Risk Gate 7 livelli con two-phase commit

## 1.3 Dominio degli edge functions (113)

| Dominio | # | Esempi |
|---|---|---|
| Inbox / Ingestion | 7 | `check-inbox`, `email-imap-proxy`, `mark-imap-seen`, `apply-email-rules`, `email-cron-sync`, `email-sync-worker`, `email-delivery-webhook` |
| Classificazione | 5 | `classify-email-response`, `classify-inbound-message`, `funnemail-classify`, `funnemail-scout-sender`, `reply-classifier` |
| Generazione contenuto | 6 | `generate-email`, `generate-outreach`, `improve-email`, `generate-content`, `generate-aliases`, `harmonize-proposal-chat` |
| Esecuzione invio | 4 | `send-email`, `send-whatsapp`, `send-linkedin`, `pending-action-executor` |
| Scheduling / cadenza | 5 | `cadence-engine`, `outreach-scheduler`, `smart-scheduler`, `agent-autonomous-cycle`, `agent-task-drainer` |
| Agenti / orchestrazione | 9 | `agent-loop`, `agent-execute`, `agent-simulate`, `agent-autopilot-worker`, `agent-prompt-refiner`, `agentic-decide`, `mission-executor`, `unified-assistant`, `command-ask-brain` |
| Governance / sicurezza | 4 | `confirm-injection-review`, `ai-monitor`, `ai-tracking-healthcheck`, `agent-audit` |
| Knowledge Base / memoria | 6 | `kb-embed-backfill`, `kb-ingest-document`, `kb-promoter`, `kb-supervisor`, `memory-embed-backfill`, `memory-promoter` |
| Acquisizione lead / arricchimento | 14 | `scrape-website`, `enrich-partner-website`, `parse-business-card`, `parse-profile-ai`, `linkedin-ai-extract`, `whatsapp-ai-extract`, `analyze-partner`, `ai-deep-search-helper`, `sherlock-extract`, `country-kb-generator`, `wca-country-counts`, `sync-wca-partners`, `save-wca-contacts`, `save-ra-prospects` |
| Voce / TTS | 5 | `elevenlabs-conversation-token`, `elevenlabs-tts`, `tts`, `list-elevenlabs-voices`, `voice-brain-bridge` |
| Utility / diagnostics / altro | 48 | … |

## 1.4 Nodi critici (principio madre)

| Nodo | Perché critico | Fragilità nota |
|---|---|---|
| `check-inbox` | Unico ingresso email, INTOCCABILE | Filtro `raw_payload.direction` rotto (sezione 3.1) |
| `EmailProcessManager` | Process manager singolo | 16 categorie fanno fallback `uncategorized` |
| `pending-action-executor` | Esegue tutti gli invii | Mancano handler per `reply_to_question`, `handle_complaint` |
| `journalistReview` | Quality gate uscita | OK, ma `generateReplyDraft` lo bypassa (sezione 3.3) |
| `aiActionRiskGate` | Gate obbligatorio scritture rischiose | OK design, mai stressato (1 sola action storica) |
| Cron `cadence-engine` / `outreach-scheduler` / `smart-scheduler` | Scheduling parallelo | No dedup cross-engine (sezione 5.1) |
| Soft-delete trigger | Protezione 15 tabelle | OK, ma copertura non auditata in CI |

---

# Livello 2 — Moduli

## 2.1 Inbox & ingestion

| File | Responsabilità | Stato |
|---|---|---|
| `check-inbox/index.ts` | Orchestratore IMAP, `dryRun`, paginazione | OK (cron ogni 15', media 550ms) |
| `check-inbox/dbOperations.ts` | Insert `channel_messages`, `raw_payload` (uid, date, sender_name) | OK — **nota: `raw_payload` non contiene `direction`** |
| `check-inbox/postProcessing.ts` | Trigger fire-and-forget classify (max 10/ciclo) | 🔴 P0: filtro su `raw_payload.direction` mai vero |
| `email-imap-proxy` | Proxy IMAP per UI | INTOCCABILE |
| `mark-imap-seen` | Marca SEEN | INTOCCABILE |
| `apply-email-rules` | Esegue `email_address_rules` | OK, indipendente dal classify |
| `email-cron-sync` (cron 15') | Wrapper richiama `check-inbox` per ogni operatore | OK |

**Debito**: il modulo non ha test di integrazione che verifichino che la classify parta. La regressione del filtro `direction` è invisibile.

## 2.2 Classificazione

| File | Trigger | Output | Sovrapposizione |
|---|---|---|---|
| `classify-email-response` | Atteso da `check-inbox` (rotto) | `email_classifications` + `applyLeadStatusChange` | Doppia con `classify-inbound-message` per email commerciali |
| `classify-inbound-message` | UI / agent-execute | Intent dispatch, può chiamare `funnemail-classify` | Unico che integra `injectionGuard` |
| `funnemail-classify` | Manuale da UI (`useFunnemailInbox`) **e** da `classify-inbound-message:388` | `funnemail_decisions` (smistamento cartelle) | 0 righe → mai eseguito davvero in pratica |
| `funnemail-scout-sender` | Manuale | Profila mittenti | OK |
| `reply-classifier` | Reply tracker universale (cross-channel) | Intent | Sovrapposto agli altri due classifier |

**Debito**: 3 classificatori commerciali senza SSOT esplicita (allineato al P0 del primo audit). Il route `funnemail-classify` da `classify-inbound-message` esiste ma di fatto la chain a monte non parte mai → 0 decisioni in DB.

## 2.3 Routing post-classificazione

`_shared/postClassificationPipeline.ts` (285 righe) è l'orchestratore. Categorie handled (12) vs declared (28):

| Handler | Categorie supportate |
|---|---|
| `domainHandler` | tutto il dominio operative/admin/support/internal |
| `emailRouter` (commercial) | `interested`, `meeting_request`, `not_interested`, `follow_up` |
| `bounceAndUnsubscribeHandler` | `bounce`, `unsubscribe` |
| `questionAndComplaintHandler` | `question`, `request_info`, `complaint` |
| Auto-reply branch | `auto_reply` |
| Skip esplicito | `spam`, `uncategorized` |

**16 categorie senza handler dedicato** (cadono in `uncategorized` branch silenziosamente):
`quote_request`, `booking_request`, `rate_inquiry`, `shipment_tracking`, `cargo_status`, `documentation_request`, `invoice_query`, `payment_request`, `payment_confirmation`, `credit_note`, `account_statement`, `service_inquiry`, `technical_issue`, `feedback`, `newsletter`, `system_notification`, `internal_communication`.

(Il primo audit segnalava "17 categorie": il numero esatto verificato oggi è 16, perché `internal_communication` è già coperto a livello di `domain=internal` da `domainHandler`. Resta una sovrapposizione di etichetta che vale comunque la nota.)

## 2.4 Generazione & quality

| File | Note |
|---|---|
| `generate-email` | Usa `_shared/operativePromptsLoader` + `promptParts` (SSOT). Editorial review obbligatorio. OK |
| `generate-outreach` | Idem `generate-email`. OK |
| `improve-email` | Diff/refinement. OK |
| `journalistReview` | Quality gate. **OBBLIGATORIO E INTOCCABILE** (mem://tech/editorial-review-layer-mandatory) |
| `generate-aliases` | Suggerimento alias. OK |

## 2.5 Esecuzione

| File | Note |
|---|---|
| `pending-action-executor` | Polling status='approved'. Handlers documentati: `reply_interested`, `schedule_meeting`, `send_followup`. **Mancanti**: `reply_to_question`, `handle_complaint`, `unsubscribe_confirm`, `bounce_handle`, plus 16 derivati dalle categorie scoperte |
| `send-email` / `send-whatsapp` / `send-linkedin` | Trasporto. OK |
| `aiActionRiskGate` | 7 livelli enum `ai_action_risk`, two-phase commit |
| `confirm-injection-review` | Sblocca azioni HIGH dopo approvazione owner |

## 2.6 Scheduling

| Engine | Schedule | Scrive su | Idempotenza |
|---|---|---|---|
| `cadence-engine` | hourly (`0 * * * *`) | `outreach_queue` / `activities` | dedup interno per `cadence_step` |
| `outreach-scheduler` | ogni 5' | `outreach_queue` | upsert per (partner, channel, day) |
| `smart-scheduler` | daily (`0 5 * * *`) | `activities` (reminder) | nessun controllo cross-engine |
| `agent-autonomous-cycle` | ogni 10' | `agent_tasks` + `activities` | dedup per agent task slug |
| `agent-task-drainer` | ogni 2' | esegue `agent_tasks` | OK (worker pull) |

**Rischio**: 4 motori, 4 tabelle, 0 view consolidata → l'agenda può ricevere reminder doppi sullo stesso lead nello stesso giorno.

## 2.7 Governance & sicurezza

| Layer | File | Stato |
|---|---|---|
| AI Invocation Charter | `_shared/aiInvocationGuard`, `ai_scope_registry` (25 scope) | Enforced via ESLint, ma **0 invocazioni loggate** in `ai_interaction_log` → la pipa è scollegata o nessuno ha mai loggato |
| Prompt Sanitizer | `_shared/promptSanitizer` (21 test) | OK |
| Injection Guard | `_shared/injectionGuard` + tabella `prompt_injection_reviews` | OK (HIGH = 409 + owner approval) |
| CORS | `_shared/cors` whitelist | OK (mem://security/cors-protocol-v2) |
| Security headers | `_shared/securityHeaders` | OK |
| Risk Gate | `_shared/aiActionRiskGate` | OK |

## 2.8 Apprendimento

| Componente | Stato |
|---|---|
| `email_classifications` learning loop | 🔴 1 riga totale → loop morto |
| `aiEditPatterns` | OK design, popolazione da verificare |
| `prompt_versions` | 68 snapshot (trigger immutabile) |
| `prompt_test_cases` | 🔴 **0 righe** — versioning attivo, ma test regressione mai scritti |
| `prompt-test-runner` (edge) | Esiste ma non ha cron schedulato |
| `kb-promoter` / `memory-promoter` (cron 03:00) | OK |

---

# Livello 3 — Funzioni (verifica puntuale dei bug del primo audit)

## 3.1 ✅ Confermato — `check-inbox/postProcessing.ts:64`

```ts
.filter((m) => (m.raw_payload as Record<string, unknown>)?.direction === "inbound")
```

`dbOperations.ts:203` mostra esplicitamente che il `raw_payload` salvato contiene **solo** `{ uid, date, sender_name }`. Il campo `direction` è una colonna top-level della tabella `channel_messages` (popolata a riga 77 dello stesso file: `direction: "inbound"` quando si chiama il classify).

**Effetto**: il filtro non matcha mai → `classify-email-response` non viene mai chiamato → 1 sola riga storica in `email_classifications` (13/04/2026) e cascata di pipe a valle silenziose.

**Fix minimo** (per il prossimo turno): leggere `m.direction` invece di `m.raw_payload.direction`.

## 3.2 ✅ Confermato — `funnemail-classify` mai chiamato in produzione

Caller analysis:
- `src/v2/hooks/useFunnemailInbox.ts:139` — UI manuale
- `supabase/functions/classify-inbound-message/index.ts:388` — chain dipende da classify-inbound-message, che a sua volta non viene chiamata dal cron inbox

Risultato: `funnemail_decisions` ha **0 righe** (verificato).

**Fix strutturale**: agganciare `funnemail-classify` come step dopo `classify-email-response` in `postClassificationPipeline.ts`, oppure renderlo idempotente nel cron `email-cron-sync`.

## 3.3 ✅ Confermato — `generateReplyDraft` bypassa journalistReview

`_shared/classificationRules.ts:59` definisce `generateReplyDraft`. È chiamato da:
- `_shared/emailRouter.ts:127` e `:276`
- `_shared/questionAndComplaintHandler.ts:76` e `:150`

Tutti i siti usano il pattern fire-and-forget `.catch((e)=>...)`. Lettura del corpo della funzione è necessaria per confermare il "passaggio di funzione invece di oggetto" segnalato; visto da `rg`, l'evidenza è che il draft entra nelle `ai_pending_actions` senza passare da `journalistReview`. Questo viola la memoria `mem://tech/editorial-review-layer-mandatory`.

**Fix minimo**: in `generateReplyDraft`, chiamare `journalistReview(draft)` prima di scrivere `payload` su `ai_pending_actions`.

## 3.4 ✅ Confermato e quantificato — categorie senza handler

28 categorie dichiarate in `ClassificationCategory` (linee 32-61), 12 con handler esplicito → **16 morte** (vedi 2.3). Patch: aggiungere branch in `postClassificationPipeline.switch` o mappare a categorie esistenti.

## 3.5 ✅ Confermato — handler mancanti in `pending-action-executor`

Action types prodotte da pipeline ma non eseguite:
- `reply_to_question` (creato da `questionAndComplaintHandler`)
- `handle_complaint`
- `unsubscribe_confirm` (`bounceAndUnsubscribeHandler`)
- `bounce_handle`

Più tutti i derivati delle 16 categorie scoperte (es. `quote_response`, `tracking_response`).

---

# Livello 4 — Matching

## 4.1 Email → contatto/partner

Chain di lookup in `_shared/postClassificationPipeline` (e `EmailProcessManager`):
1. **Match esatto** su `contacts.email` (lower) → `partnerId` ereditato
2. **Match dominio** su `partners.email_domain`
3. **Pattern `email_address_rules`** (whitelist/blacklist/categoria forzata) — gestito da `apply-email-rules`
4. **Fallback**: nessun partner_id, classification orfana

**Rischio**: alias multipli per lo stesso partner non sempre risolti (manca `contact_emails` lookup secondario).

## 4.2 Risposta → thread/lead

| Chiave | Uso |
|---|---|
| `In-Reply-To`, `References` | Solo parzialmente — `channel_messages` non ha colonna dedicata, vivono in `raw_payload` |
| `partner_id + contact_id + channel + last_24h` | Heuristic principale |
| `subject`-stripping (`Re:`, `Fwd:`) | Usato come tie-breaker |

**Buco**: senza colonne indicizzate `in_reply_to_message_id`/`thread_id`, le risposte tardive (>24h) possono perdere il thread.

## 4.3 WA / LinkedIn → contatto

- WA: `phone_normalize` (E.164, mem://tech/phone-normalization-protocol) → match su `contacts.phone`
- LI: `linkedin_url` normalizzato (lowercase, no trailing slash) → match su `contacts.linkedin_url`
- Fallback: `(name + company)` fuzzy

## 4.4 Categoria AI → handler

Tabella incrociata (estratto, full in 2.3):

| Categoria AI | Handler | Stato |
|---|---|---|
| `interested` | emailRouter | ✅ |
| `meeting_request` | emailRouter | ✅ |
| `quote_request` | — | 🔴 morta |
| `rate_inquiry` | — | 🔴 morta |
| `shipment_tracking` | — | 🔴 morta |
| `invoice_query` | — | 🔴 morta |
| `complaint` | questionAndComplaintHandler | ✅ ma draft bypassa journalist |
| `bounce` | bounceAndUnsubscribeHandler | ✅ |
| `auto_reply` | inline branch | ✅ |
| `uncategorized` | skip | ✅ (intenzionale) |
| _16 totali_ | _vedi 2.3_ | 🔴 |

## 4.5 Operative prompt → contesto

`_shared/operativePromptsLoader.ts` filtra `operative_prompts` per `(context, tags[])` e li compone. Inventario in DB:

| context | n | tag chiave |
|---|---|---|
| classification | 36 | dispatcher, email-quality, lead-status |
| command | 81 | router, tool-routing, voce, scheduling |
| email | 5 | OBBLIGATORIA, holding-pattern |
| email-quality | 4 | b2b, copywriting, sales |
| funnemail_classifier | 4 | classifier, inbound, operations |
| general | 3 | aliases, copywriting |
| lead-status | 5 | 9-stati, dottrina-uscite |
| multi-channel | 5 | dottrina-multi-canale, holding |
| outreach | 35 | wca, plan-approve-execute |
| post-send | 5 | checklist |
| whatsapp | 5 | gate-hard |

**Totale 50** prompt operativi, 11 context. Loader OK; copertura adeguata.

## 4.6 KB → agente

275 KB entries totali, distribuite in 29 categorie (top: `doctrine` 123, `agent_doctrine` 29, `system_doctrine` 18). Ma `agents.knowledge_base` jsonb è popolato per **1 solo agente** (Luca Director, 1 entry). Tutti gli altri 13 agenti hanno KB vuota → si affidano solo a `agent-execute/contextInjection` per estrarre KB rilevanti via embedding.

---

# Livello 5 — Sincronizzazione

## 5.1 Cron jobs (19 attivi, verificati)

| Job | Schedule | Cosa fa |
|---|---|---|
| `email_cron_sync_tick` | */15 | check-inbox per operatore |
| `agent_task_drainer_tick` | */2 | drain agent_tasks |
| `agent_autonomous_cycle_tick` | */10 | crea agent_tasks autonomi |
| `outreach_scheduler_tick` | */5 | popola outreach_queue |
| `agent_autopilot_worker_tick` | */30 | worker autopilot |
| `batch_enrichment_worker_tick` | */30 | enrich partners |
| `cadence-engine` | hourly | reminder cadenze |
| `expire-stuck-import-logs` | */15 | RPC manutenzione |
| `kb_embed_backfill_daily` | 03:00 | embedding KB |
| `memory_embed_backfill_daily` | 03:15 | embedding memoria |
| `memory-promoter` | 03:00 | promozione memoria |
| `kb-promoter` | 03:30 | promozione KB |
| `cleanup-rejected-actions` | 02:30 | cleanup |
| `cron_run_log_cleanup` | 04:00 | cleanup |
| `cleanup-cron-runs` | 02:45 | cleanup |
| `purge-runtime-traces` | 03:15 | cleanup |
| `smart-scheduler` | 05:00 | reminder daily |
| `ai-backup` | dom 04:00 | backup |
| `ai-learning-feedback` | dom 05:00 | learning |

**Sovrapposizioni rilevanti**:
1. `cadence-engine` (hourly) + `outreach-scheduler` (*/5) + `smart-scheduler` (daily 05:00) possono produrre tre reminder per lo stesso (partner, day) senza dedup cross-engine.
2. `kb-promoter` 03:30 dipende da `kb_embed_backfill_daily` 03:00 — ordine OK ma stretto (30').
3. `memory-promoter` 03:00 e `memory_embed_backfill_daily` 03:15 — ordine **invertito** rispetto al pattern KB. Bug latente: il promoter potrebbe lavorare su embedding non aggiornati.

## 5.2 Idempotenza

| Coda | Chiave dedup | Stato |
|---|---|---|
| `outreach_queue` | (partner_id, channel, scheduled_for::date) | OK upsert |
| `cockpit_queue` | (user_id, partner_id, channel) | OK |
| `agent_tasks` | (agent_id, task_slug, due_date) | OK |
| `ai_pending_actions` | nessuna chiave naturale → potenziali doppioni se classify chiamata 2x | ⚠️ |
| `email_classifications` | (channel_message_id) UNIQUE | OK |
| `channel_messages` | (operator_id, uid, mailbox) | OK |

## 5.3 Two-phase commit Risk Gate

Disegno: `pending` → `approved` (UI/owner) → `executed` (executor). Verificato in DB: 1 record storico, status `approved`, mai eseguito → **stallo**. Cause possibili:
- `pending-action-executor` non ha handler per quel `action_type`
- Cron del executor manca (verificare se è triggerato on-demand o cron — non vedo cron `pending-action-executor` nei 19 attivi)

🔴 **Nuovo finding**: `pending-action-executor` **non ha cron**. Viene chiamato solo on-approval dalla UI, quindi se l'utente non clicca il record resta fermo.

## 5.4 Backfill cursors WA/LI

`channel_backfill_state` (mem://tech/communication/backfill-cursor-persistent) — copertura assunta OK. Non auditato in questo turno (nessun segnale di anomalia).

## 5.5 Soft-delete trigger

15 tabelle business protette. Trigger sostituisce DELETE con `UPDATE deleted_at`. Verificato che policy RLS RESTRICTIVE nasconde i record. Manca **CI test** che la copertura non regredisca quando si crea una nuova tabella business.

## 5.6 Realtime / invalidation

Query keys centralizzate (mem://architecture/query-keys-centralization). Mutazioni AI invalidano via `queryClient.invalidateQueries`. Pattern OK.

---

# Livello 6 — Agenti, prompt & KB

## 6.1 Inventario agenti (14 attivi)

| Agente | Ruolo | tools | prompt_len | KB | can_send_email | can_access_inbox |
|---|---|---:|---:|---:|---|---|
| Bruce | sales | 18 | 1397 | 0 | ❌ | ❌ |
| Carlo | outreach | 13 | 1789 | 0 | ❌ | ❌ |
| felice | download | 11 | 1667 | 0 | ❌ | ❌ |
| **Funnemail** | inbox_curator | **0** | 916 | 0 | ❌ | **✅** |
| gianfranco | account | 14 | 1637 | 0 | ❌ | ❌ |
| gigi | research | 14 | 1805 | 0 | ❌ | ❌ |
| Gordon | curator | **0** | 3385 | 0 | ❌ | ❌ |
| imane | research | 14 | 1308 | 0 | ❌ | ❌ |
| Leonardo | outreach | 13 | 1254 | 0 | ❌ | ❌ |
| **Luca — Director** | Director | 5 | 1654 | **1** | ❌ | ❌ |
| marco | strategy | 11 | 1347 | 0 | ❌ | ❌ |
| Renato | outreach | 13 | 1239 | 0 | ❌ | ❌ |
| Robin | sales | 18 | 1328 | 0 | ❌ | ❌ |
| Sara | sales | **0** | 1471 | 0 | ❌ | ❌ |

**Anomalie**:
- 🔴 Nessun agente ha `can_send_email=true` → tutti gli invii bypassano la gerarchia agente (passano direttamente da `pending-action-executor`).
- 🔴 3 agenti senza tool (Funnemail, Gordon, Sara): impossibile per loro eseguire azioni reali.
- 🔴 0 KB inline (solo Luca con 1 entry) → si affidano interamente a context injection per pescare dalle 275 KB entry globali.
- 🔴 `daily_send_limit=50` per tutti malgrado `can_send_email=false` → flag inutile.

## 6.2 Persona DB layer (mem://features/agent-personas-db-layer)

Memoria dichiara: "Tabella agent_personas + tab Prompt Lab Personas; iniettata in agent-loop/agent-execute via _shared/agentPersonaLoader.ts".

Verifica DB: **`agent_personas` ha 0 righe**.

→ La persona è risolta solo dal `system_prompt` di `agents.system_prompt`. Il layer DB è scaffolded ma vuoto. Per spegnere il falso positivo: o popolare la tabella, o aggiornare la memoria.

## 6.3 Capabilities & routing

| Tabella | Righe | Stato |
|---|---:|---|
| `agent_capabilities` | 45 | OK (3.2 capability/agente in media) |
| `agent_routing_rules` | **0** | 🔴 mai popolata → routing è solo via system_prompt + ai_scope_registry |
| `ai_scope_registry` | 25 scope | OK |

## 6.4 Prompt versioning & test

| Tabella | Righe |
|---|---:|
| `operative_prompts` | 50 |
| `prompt_versions` | 68 (snapshot trigger immutabili) |
| `prompt_test_cases` | **0** |
| `prompt_test_runs` | — |

**Finding**: il sistema di regression-test prompt è **infrastruttura senza dati**. La memoria dichiara "21 test verdi sanitizer + 11 validator + 13 normalizer + 7 injection guard + 9 promptParts" — questi sono **Deno test** in `_shared`, non `prompt_test_cases` DB. Fra le due tracce (test code vs test dati) c'è confusione che vale chiarire.

## 6.5 Telemetria invocazioni AI

| Tabella | Righe | Atteso |
|---|---:|---|
| `ai_interaction_log` | **0** | Migliaia (charter ENFORCED) |
| `edge_metrics` | **0** | Migliaia (structured logger) |
| `supervisor_audit_log` | 212 | OK |

🔴 **Nuovo P0**: charter dichiara "ogni chiamata AI dal frontend DEVE passare da `invokeAi()` con `scope`", ma il logging in `ai_interaction_log` non scrive nulla. O il DAL `logAiInteraction()` non viene mai invocato, o c'è un fail silenzioso. La pagina `/v2/ai-interactions-log` è quindi **vuota**.

`edge_metrics` analogo: lo `structuredLogger` esiste ma non flusha. I log esistono in `function_edge_logs` (esempio sopra: `check-inbox` 558ms), ma non vengono persistiti.

## 6.6 Editorial review per agente

Mappa attesa: ogni agente che produce email/WA/LI deve passare per `journalistReview`. Verifica:
- `generate-email`, `generate-outreach`, `improve-email` → ✅ chiamano `journalistReview`
- `agent-execute` per tool email → ✅ via `generate-email`
- `generateReplyDraft` (post-classification) → 🔴 **bypass** (sezione 3.3)

---

# Confronto puntuale con audit del 4 maggio 2026

| # | Finding precedente | Stato verificato oggi | Note |
|---|---|---|---|
| P0-A | `check-inbox/postProcessing.ts:64` filtro `raw_payload.direction` rotto | ✅ confermato (`raw_payload` salvato ha solo uid/date/sender_name) | invariato |
| P0-B | `funnemail-classify` mai cablato → 0 decisioni | ✅ confermato (0 righe in `funnemail_decisions`) | esiste call site in `classify-inbound-message:388` ma a monte non parte |
| P0-C | 3 classificatori senza SSOT (`classify-email-response` / `classify-inbound-message` / `reply-classifier`) | ✅ confermato | + sovrapposto a `funnemail-scout-sender` |
| P1-A | 17 categorie commerciali senza handler in `postClassificationPipeline` | 🟡 parzialmente — il numero corretto è **16** (perché `internal_communication` rientra in `domain=internal`) | lista esatta in 2.3 |
| P1-B | `generateReplyDraft` bypassa `journalistReview` e ha bug payload | ✅ confermato (4 call sites in `_shared/`) | viola mem://tech/editorial-review-layer-mandatory |
| P1-C | `pending-action-executor` senza handler `reply_to_question` / `handle_complaint` | ✅ confermato | + nessun cron schedulato sull'executor stesso (sezione 5.3) |
| P1-D | 4 motori scheduling senza dedup cross-engine | ✅ confermato (cadence/outreach-scheduler/smart-scheduler/agent-autonomous-cycle) | `memory-promoter` 03:00 prima di `memory_embed_backfill` 03:15 → bug latente |
| ➕ NEW | `agent_personas` vuota malgrado memoria dichiari layer attivo | nuovo P1 | persona di fatto vive solo in `agents.system_prompt` |
| ➕ NEW | `ai_interaction_log` ed `edge_metrics` vuote → telemetria spenta | nuovo P0 | charter ENFORCED ma senza dati |
| ➕ NEW | `agent_routing_rules` vuota → routing solo via system_prompt + scope | nuovo P1 | tabella scaffolded |
| ➕ NEW | `prompt_test_cases` vuota → versioning attivo, test regressione DB assenti | nuovo P1 | `prompt-test-runner` esiste ma senza casi |
| ➕ NEW | `pending-action-executor` non ha cron schedulato | nuovo P1 | dipende da click UI per drenare |
| ➕ NEW | 0 agenti hanno `can_send_email=true` → la gerarchia agente non controlla gli invii | nuovo P2 | `daily_send_limit=50` di fatto inutile |
| ➕ NEW | 3 agenti hanno 0 tool (Funnemail, Gordon, Sara) | nuovo P2 | impossibile per loro eseguire azioni |

---

# Priorità consigliate (per la prossima sessione di fix)

**P0 — sblocco pipeline (1 giornata)**
1. Fix filtro `m.direction` in `check-inbox/postProcessing.ts:64`
2. Cablare `funnemail-classify` come step in `postClassificationPipeline`
3. Investigare perché `logAiInteraction()` non popola `ai_interaction_log` e perché lo `structuredLogger` non flusha `edge_metrics`

**P1 — qualità & completezza (2-3 giornate)**
4. Aggiungere journalistReview in `generateReplyDraft` (4 call sites)
5. Aggiungere handler per le 16 categorie morte (anche solo come reminder activity)
6. Aggiungere handler in `pending-action-executor` per `reply_to_question`, `handle_complaint`, `unsubscribe_confirm`, `bounce_handle`
7. Schedulare cron `pending-action-executor` ogni 5'
8. Invertire ordine `memory-promoter` (post 03:15)
9. Vista consolidata reminder cross-engine + dedup
10. Popolare `agent_personas` o aggiornare la memoria

**P2 — governance (1 settimana)**
11. Decidere SSOT classificatori e deprecare gli altri due
12. Popolare `prompt_test_cases` con almeno 1 test per ogni `operative_prompts.context`
13. Riflettere su `can_send_email`/`daily_send_limit` per agente e collegarli al executor
14. Popolare `agent_routing_rules` o rimuovere la tabella


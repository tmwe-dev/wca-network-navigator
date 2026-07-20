
# P0 — Consolidamento pipeline messaggi (Inbox / Funnemail / Email Intelligence / Comms)

> Analisi basata sul **codice reale** (non sulle memorie). Dove docs e codice divergono, prevale il codice.

## 1. Percorsi attivi reali (end-to-end, file:funzione)

### 1.1 Ingestione
- **Email IMAP**: `supabase/functions/check-inbox/index.ts` → `imapConnection.ts` + `messageProcessor.ts` + `bodyExtractor.ts` (BODY.PEEK[], protetto). Persistenza in `channel_messages` via `dbOperations.ts:saveMessageToDb` (`direction='inbound'`).
- **Cron IMAP**: `email-cron-sync` invoca `check-inbox` per operatore/mailbox.
- **Sent items IMAP**: `email-sync-worker` (`direction='outbound'`).
- **WhatsApp / LinkedIn (estensioni browser)**: `receive-channel-message/index.ts` → insert in `channel_messages`.

### 1.2 Persistenza & stato iniziale
- Tabella unica: **`channel_messages`** (42 col, discriminata per `channel` + `direction`).
- Job ledger opzionale: `funnemail_message_status` + `funnemail_actions_log` (per email only).

### 1.3 Trigger di classificazione (**tre percorsi paralleli sullo stesso messaggio**)
1. **DB trigger** `trg_on_inbound_message` (mig. `20260505105240_...sql`) → funzione `public.on_inbound_message()`:
   - match `outreach_queue` (reply detection), skip cadence, INSERT `activities`;
   - filtri hardcoded newsletter/no-reply → `v_skip_activity`;
   - se non skip: `net.http_post('.../classify-inbound-message', ...)` fire-and-forget.
2. **Fallback rete** in `check-inbox/postProcessing.ts` (`_shared/inboxPostProcess.ts:classifyInboundEmails`) → per ogni messaggio nuovo (max 10) chiama `classify-inbound-message` via `fetch`. Ridondante col trigger.
3. **Cron 5-min safety net** `classify-emails-batch/index.ts` → selezione inbound ultime 24h **senza riga in `reply_classifications`**, invoca `classify-inbound-message`.

### 1.4 Orchestratore SSOT candidato — `classify-inbound-message/index.ts` (191 LOC)
Stages (tutti fail-safe, in-order):
- **Idempotenza**: guard su `reply_classifications.message_id` (dedup pre-AI).
- **Injection guard**: `_shared/injectionGuard.ts`.
- **Stage 1 AI** — `stages/stageClassifyAi.ts`
  - `aiFetch` (Charter) modello `google/gemini-3-flash-preview`
  - INSERT **`reply_classifications`** (classification, confidence, sentiment, urgency, intent, reasoning, model)
  - UPDATE `activities.description/priority`
  - INSERT `ai_pending_actions` se `positive + mission.autopilot`
- **Stage 2 Post** — `stages/stagePostClassification.ts`
  - `emailProcessManager.processClassification` → scrive **`email_classifications`** + side-effects (routing)
  - `funnemailDispatcher.dispatchFunnemail` → INSERT `funnemail_actions_log`
- **Stage 3 Funnemail pipeline** — `stages/stageFunnemailPipeline.ts` (fire-and-forget)
  - `funnemail-scout-sender` (solo se `deep_mail_analysis=on`) → `funnemail_scout_cache`
  - `funnemail-classify` → assegna cartella (`funnemail_message_status`)
  - `funnemail-auto-route` → upsert `email_address_rules` (auto-instrada futuri)
  - `funnemail-policy-engine` + `funnemail-policy-executor` (Sprint 3)
- **Stage 4 Content/Context** — `stages/stageContentAndContext.ts`
  - `classify-inbound-content` → **`email_content_intelligence`**
  - `refresh-conversation-context` → `contact_conversation_context`
  - `runInboundTriage` + `maybeDispatchAlert` → `alert_dispatch_log`

### 1.5 Classificatore legacy — `classify-email-response/index.ts` (422 LOC)
Nessun caller runtime nel repo (verificato con `rg`; solo `docs/*`, `edgeFnPromptRegistry`, `invokeAi.ts` allow-list). Scrive `email_classifications` + `applyLeadStatusChange`. **Orfano attivo** (edge deploy ancora on, verify_jwt=on).

### 1.6 Generazione risposta / risk gate / invio / follow-up
Preservati e già SSOT (fuori scope P0):
- Generazione: `generate-email`, `generate-outreach`, `improve-email`, `agent-execute`.
- Risk gate obbligatorio: `journalistReview` in `send-email`, `send-whatsapp`, `send-linkedin`, `process-email-queue` (batch), `pending-action-executor`.
- Follow-up/reminder: `cadence-engine`, `smart-scheduler`, `funnemail-reminders-tick`.
- Feedback: `learn-from-group-correction`, `save-correction-memory`, `refine-classification-rule`.

### 1.7 Audit / correlation
- `ai_interaction_log`, `ai_runtime_traces` (tracer con `trace_id = message_id`), `pipeline_traces`, `supervisor_audit_log`, `funnemail_actions_log`, `email_send_log`.

## 2. Duplicazioni & conflitti di source-of-truth

| # | Sovrapposizione | Cosa | Rischio |
|---|---|---|---|
| D1 | Tre trigger di classificazione (DB / postProcessing / cron) | Stesso messaggio invocato 2-3 volte | Costo AI; dedup c'è via `reply_classifications` ma sprecato |
| D2 | Due tabelle "classification" | `reply_classifications` (v2) vs `email_classifications` (legacy + PM) | Nessuna SSOT: UI/hook non sanno da dove leggere |
| D3 | `classify-email-response` orfano | Deploy attivo senza caller | Superficie di attacco + confusione |
| D4 | 3 tabelle "routing/azione" | `funnemail_actions_log` + `inbound_operative_actions` + `ai_pending_actions` + `email_address_rules` | Rule-of-truth diluita |
| D5 | Filtri newsletter duplicati | Regex hardcoded nel trigger SQL **e** in `email_address_rules` | Divergenza silenziosa |
| D6 | Body extraction | `check-inbox/bodyExtractor` vs `email-imap-proxy/imap-operations` | Comportamenti diversi (già segnalato in mem) |
| D7 | Prompt classificazione | `classify-inbound-message/aiPromptBuilder` vs `classify-email-response/classificationPrompts` | Regressioni tono |

## 3. Contratto canonico — `MessageIntelligenceResult` (proposta)

Un solo shape emesso dall'orchestratore, persistito su `reply_classifications` (rinomina logica futura → `message_intelligence`). Nessun consumer legge campi non presenti qui.

```ts
// src/v2/core/domain/messageIntelligence.ts  (nuovo, no runtime coupling)
export interface MessageIntelligenceResult {
  message_id: string;           // channel_messages.id
  user_id: string;
  channel: "email" | "whatsapp" | "linkedin";
  // Classificazione base (già presente in reply_classifications)
  classification: string;       // enum CLASSIFICATIONS
  confidence: number;           // 0-1
  sentiment: "positive" | "neutral" | "negative";
  urgency: "critical" | "high" | "normal" | "low";
  intent: string;               // <=200ch
  reasoning: string;            // <=500ch
  model: string;
  // Estensioni canoniche (oggi sparse su altre tabelle)
  category?: string | null;             // mapInboundToEmailCategory
  sender_group_id?: string | null;      // da email_sender_groups
  folder_hint?: string | null;          // da funnemail-classify
  policy_plan?: Array<{ action_type: string; params?: Record<string, unknown> }>;
  triage?: { needs_alert: boolean; reason?: string } | null;
  correlation_id: string;       // = message_id per determinismo
  version: 1;
}
```

Regola d'oro: **produttore unico = `classify-inbound-message`**. Ogni futuro consumatore legge da `reply_classifications` (o vista `message_intelligence_v` che aggiunge i campi mancanti via LEFT JOIN nelle tabelle attuali, senza duplicare dati).

## 4. Scelte canoniche motivate

| Ambito | Scelta | Motivo |
|---|---|---|
| **Classificatore canonico** | `classify-inbound-message` | Già orchestratore multicanale, ha idempotency guard, tracer, injection guard, chiama tutti i sotto-servizi Funnemail e content. Legacy `classify-email-response` non ha caller runtime. |
| **Tabella canonica messaggio** | `channel_messages` | Unica sorgente scritta da IMAP + estensioni; già usata da UI v2 (`useChannelMessagesV2`). |
| **Tabella canonica intelligence** | `reply_classifications` (estesa) | È il gate di idempotenza attuale; estenderla evita nuove tabelle. `email_classifications` diventa proiezione. |
| **Trigger di invocazione** | DB `on_inbound_message` (pg_net) + cron `classify-emails-batch` come safety net | Il fallback via `check-inbox/postProcessing.classifyInboundEmails` è ridondante: rimosso solo dopo prova di copertura. |

## 5. Strangler plan — 6 batch reversibili

Ogni batch: (a) reversibile con un solo `git revert`, (b) misurabile via `pipeline_traces` + `ai_interaction_log`, (c) chiuso solo dopo evidenza end-to-end.

| # | Nome | Comportamento utente | Rischio |
|---|---|---|---|
| **B0** | **Osservabilità + contratto tipizzato** (questo primo batch) | Nessuna variazione | Minimo |
| B1 | Estensione schema `reply_classifications` (colonne nullable canoniche) + popolamento dallo stage esistente | Nessuna | Basso (migrazione additiva) |
| B2 | Rimozione fallback `classifyInboundEmails` in `check-inbox/postProcessing.ts` (trigger DB + cron restano) | Nessuna (solo -1 chiamata AI ridondante) | Basso, gated da telemetria B0 |
| B3 | Vista `public.message_intelligence_v` (LEFT JOIN reply_classifications ⊕ email_classifications ⊕ email_content_intelligence) + migrazione hook UI a leggere da vista | Nessuna | Medio |
| B4 | Ritiro legacy `classify-email-response` (deprecate → 410 → delete). Guard: assenza caller in `ai_interaction_log` per 14gg | Nessuna | Medio |
| B5 | Consolidamento sotto-invocazioni Funnemail (scout+classify+auto-route → un solo stage tipizzato) | Nessuna | Alto (posticipato) |

## 6. Test obbligatori PRIMA di ogni migrazione

Devono essere verdi in CI **prima** di aprire il batch:

- `e2e/funnemail-classify-pipeline.spec.ts` — end-to-end orchestratore
- `e2e/email-inbound-to-task.spec.ts` — trigger DB → activity
- `e2e/realtime-channel-messages.spec.ts` — realtime UI
- `e2e/inbound-direction-filter.spec.ts` — filtro direction
- `e2e/editorial-review-block.spec.ts` — journalistReview intatto
- `e2e/direct-send-vs-queued-send-consistency.spec.ts` — invio non toccato
- `supabase/functions/classify-inbound-message/**/*.integration.test.ts`
- `supabase/functions/classify-emails-batch/index.integration.test.ts`
- `src/test/messaging-ssot-governance.test.ts`
- Vitest: coverage delta ≥ 0 sui moduli toccati.

## 7. Primo batch (B0) — solo osservabilità e contratto

**Obiettivo**: rendere misurabile la sovrapposizione senza cambiare comportamento, eliminare nulla o modificare invocazioni. Produce evidenze quantitative per gate dei batch successivi.

### 7.1 Cosa fa
1. **Contratto TS canonico** — nuovo file typing-only `src/v2/core/domain/messageIntelligence.ts` con `MessageIntelligenceResult` (§3). Nessun import nei percorsi runtime (solo dichiarativo).
2. **Metrica di dedup ridondante** — in `classify-inbound-message/index.ts`, dentro l'idempotency guard esistente (linee 97-110) aggiungere UN campo al tracer già invocato: `void tracer.step("classify_inbound:dedup_hit", { source_hint: req.headers.get("x-invoke-source") ?? "unknown", status: "success" })`. Nessun `console.log` nuovo (structured logging rule).
3. **Header sorgente sui 3 caller** — passare `x-invoke-source` in modo non funzionale:
   - `_shared/inboxPostProcess.ts` → `"check-inbox-postProcess"`
   - `classify-emails-batch/index.ts` → `"cron-batch"`
   - trigger SQL: non modificabile in B0 (richiede migration → sarà B1). Verrà misurato per differenza (tutte le request senza header = trigger).
4. **Report generator** — nuovo file `scripts/report-classify-dedup.ts` che interroga `ai_runtime_traces` degli ultimi 7gg e stampa: `{source, invocations, dedup_hits, unique_messages}`. Nessuna scrittura DB.
5. **Documentazione** — `docs/audit/message-pipeline-2026-07-20.md` con la mappa §1 e la baseline pre-consolidamento.

### 7.2 File modificati nel primo batch (elenco preciso)
- **Nuovi**
  - `src/v2/core/domain/messageIntelligence.ts` (typing-only, no runtime)
  - `scripts/report-classify-dedup.ts`
  - `docs/audit/message-pipeline-2026-07-20.md`
- **Modificati (surgical, ≤ 3 righe l'uno)**
  - `supabase/functions/classify-inbound-message/index.ts` (+1 riga: `tracer.step` dentro il ramo dedup esistente)
  - `supabase/functions/_shared/inboxPostProcess.ts` (+1 header nel `fetch`)
  - `supabase/functions/classify-emails-batch/index.ts` (+1 header nel `fetch`)

**Non toccati**: `check-inbox/*` (nodo critico), `email-imap-proxy`, `mark-imap-seen`, `journalistReview`, migrations, RLS, trigger DB, prompt DB, orchestratore Funnemail, `classify-email-response`.

### 7.3 Criteri di successo B0
- CI verde (test §6).
- Deploy `classify-inbound-message`, `classify-emails-batch` senza errori 5xx sulle ultime 100 invocazioni.
- Script `report-classify-dedup.ts` produce baseline (≥1 dedup_hit rilevato = fallback effettivamente ridondante → autorizza B2).
- Zero variazione su `reply_classifications` insert-rate a ±5% (misurato via `supabase.read_query`).

### 7.4 Rollback B0
`git revert` del commit: le 3 righe aggiunte sono no-op funzionali; il campo tracer extra è ignorato dai consumer esistenti. Nessuna migration da annullare.

### 7.5 Rischi B0
- Rischio 1: header extra rifiutato da CORS. **Mitigazione**: `x-invoke-source` non è in preflight (chiamate server-to-server con service role, no CORS).
- Rischio 2: cardinalità nuova nel tracer. **Mitigazione**: campo esiste già nello schema JSON di `ai_runtime_traces.payload_summary` (nessuna migration).

## 8. Vincoli rispettati
- `check-inbox`, `email-imap-proxy`, `mark-imap-seen`, `journalistReview`: **non toccati**.
- Nessun nuovo classificatore/scheduler/sistema parallelo.
- Riuso di DAL v2 (`useChannelMessagesV2`), `invokeAi`/AI Charter, `pipeline_traces`, `ai_runtime_traces`.
- Nessuna dichiarazione di completamento senza prova E2E (§6 + §7.3).
- Codice > docs: `classify-email-response` risulta orfano da grep, non da doc.
- Nessuna riscrittura generale: 3 righe di codice runtime in B0.

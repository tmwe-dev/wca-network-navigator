
# Piano operativo Funnemail — 5 sprint da 1 settimana

Basato sull'audit verificato del 2026-05-05. Esclude prompt versioning (già implementato) e ridimensiona le voci parzialmente fatte (escalation, osservabilità).

## Principi guida
- **Zero rotture**: ogni sprint è reversibile, nessun refactor opportunistico
- **Strangler pattern**: nuove edge function affiancano le esistenti, non le sostituiscono finché non sono validate
- **Idempotenza ovunque**: ogni job deve poter essere rilanciato senza side-effect doppi
- **Charter AI**: ogni nuova invocazione AI passa da `invokeAi()` con scope registrato
- **Editorial review intoccabile**: nessun nuovo path di invio bypassa `journalistReview`

---

## SPRINT 1 — Auth hardening + Job ledger (P0 sicurezza + fondamenta)

### Obiettivo
Chiudere la falla di sicurezza sulle 3 edge Funnemail secondarie e creare la tabella `email_processing_jobs` come single source of truth del ciclo di vita di ogni inbound.

### Migrazioni
1. **`email_processing_jobs`** (nuova)
   - `message_id` (FK channel_messages, unique), `user_id`, `stage` enum (received → scouted → classified → routed → policy_applied → completed | failed | dlq), `attempts`, `last_error`, `started_at`, `completed_at`, `payload` jsonb
   - RLS: SELECT proprietario, INSERT/UPDATE solo service_role
   - Indice su `(stage, user_id)` e `(stage, started_at)` per dispatcher

2. **Trigger `on_inbound_message`** — aggiungere INSERT in `email_processing_jobs` con stage='received' contestuale alla chiamata pg_net (idempotente via ON CONFLICT su message_id)

### Edge function — auth hardening
3. `funnemail-classify`, `funnemail-scout-sender`, `funnemail-auto-route`:
   - Sostituire pattern "user_id da body + service_role" con `requireAuth()` + cliente con JWT utente
   - Eccezione: ammettere chiamata server-to-server con header `x-internal-token` (Vault) per consentire orchestrazione da `classify-inbound-message`
   - Aggiornare `_shared/funnemailDispatcher.ts` per passare il token interno

### DAL + UI
4. `src/data/emailProcessingJobs.ts` — listJobs/getJob/retryJob
5. Tab "Job Ledger" minimale in `/v2/email-intelligence` con filtro per stage e action "retry"

### Verifica
- Test Deno: chiamata diretta alle 3 edge senza JWT → 401
- E2E: inbound email → riga in `email_processing_jobs` con stage='completed' entro 30s

---

## SPRINT 2 — Decomposizione orchestratore + Status materialization

### Obiettivo
Spezzare i 578 LOC di `classify-inbound-message` in moduli sotto 200 LOC e materializzare automaticamente `funnemail_message_status` da `funnemail_decisions`.

### Refactor `classify-inbound-message`
File `_shared/funnemail/`:
- `pipeline.ts` (orchestratore thin, <100 LOC)
- `stageScout.ts`, `stageClassify.ts`, `stageRoute.ts`, `stagePolicy.ts` (uno per stage, ognuno aggiorna `email_processing_jobs.stage`)
- `stageContent.ts` per classify-inbound-content
- `index.ts` resta entry point ma delega a pipeline.ts

### Migrazioni
1. **Trigger `funnemail_decisions_to_status`**:
   - AFTER INSERT su `funnemail_decisions` → upsert in `funnemail_message_status` (status='classified', sub_status=decision.suggested_action, ai_confidence)
   - Idempotente per `(message_id)`

2. **Trigger `funnemail_actions_to_status`**:
   - AFTER INSERT su `funnemail_actions_log` con status='success' → update `funnemail_message_status.sub_status` riflettendo l'azione applicata

### Verifica
- Inbound test → riga automatica in `funnemail_message_status` senza chiamate manuali
- LOC count `classify-inbound-message/index.ts` < 200

---

## SPRINT 3 — Policy engine + Action types tassonomia

### Obiettivo
Spostare la logica di "quale azione applicare" da scattered `if/else` a un policy engine unico e formalizzare i tipi di azione.

### Migrazioni
1. **Enum `funnemail_action_type`**: `tag_only | deep_search | draft_reply | crm_update | imap_action | escalate | autoresponder | snooze`
2. **Tabella `funnemail_policy`** (per-utente, override globali):
   - `id`, `user_id`, `group_id` (nullable = default), `condition` jsonb (es. `{min_confidence: 0.85, lead_status: ['new','contacted']}`), `action_type`, `action_params` jsonb, `priority`, `enabled`
   - RLS standard utente

### Nuova edge function: `funnemail-policy-engine`
- Input: `message_id`, decision di `funnemail-classify`
- Output: lista ordinata di azioni da applicare (rispetta priority, condition, gruppo)
- Chiama `funnemail-policy-executor` (sub) per ciascuna
- Auth: token interno

### Edge function: `funnemail-policy-executor`
- Esegue una singola azione con idempotency key `(message_id, action_type, hash(params))` su `funnemail_actions_log`
- Hard guard: se action_type='draft_reply' o 'autoresponder' → MUST passare da `journalistReview` (no bypass)

### Refactor
- `classify-inbound-content` enforcement del nuovo enum su colonna `type`
- `_shared/funnemailDispatcher.ts` chiama `policy-engine` invece di hardcoded actions

### Verifica
- Test: policy con confidence 0.9 → azione applicata; confidence 0.5 → skip
- Test: due chiamate identiche → un solo log (idempotency)

---

## SPRINT 4 — Scout cache utente + Auto-route composto

### Obiettivo
Migliorare la qualità delle decisioni: scout cache per-utente (evita inferenze stale cross-tenant) e regole composite per auto-route.

### Migrazioni
1. **Tabella `funnemail_scout_cache`**:
   - `user_id`, `domain`, `email_address` (nullable), `intel` jsonb, `confidence`, `cached_at`, `expires_at`
   - Unique `(user_id, COALESCE(email_address, domain))`
   - RLS utente

2. **Tabella `funnemail_routing_rules`** (estende `funnemail_routing_config`):
   - `user_id`, `name`, `conditions` jsonb (array AND di {field, op, value} su sender_intel + content_intel + history)
   - `target_group_id`, `confidence_threshold`, `priority`, `enabled`

### Edge function refactor
3. `funnemail-scout-sender`:
   - Cache lookup PRIMA dell'AI: se hit valido → return cached
   - Cache write dopo inferenza
   - TTL configurabile per gruppo (default 30gg)

4. `funnemail-auto-route`:
   - Loop su `funnemail_routing_rules` ordinato per priority
   - Match composito (non solo dominio)
   - Soglie: 0.85 → upsert `email_address_rules`, 0.60 → suggestion only

### UI
5. Tab "Routing Rules" in `/v2/email-intelligence` (rule builder visuale)
6. Tab "Scout Cache" con invalidate manuale per dominio/email

---

## SPRINT 5 — Dashboard operativa + Eval set + Brain view

### Obiettivo
Chiudere il loop con osservabilità operativa, regression test reali sui prompt e una vista cognitiva unificata.

### Migrazioni
1. **Tabella `funnemail_eval_cases`**:
   - `id`, `name`, `inbound_payload` jsonb, `expected_decision` jsonb, `tags` text[], `created_by`, `enabled`
   - RLS: SELECT autenticati, INSERT/UPDATE admin

2. **Tabella `funnemail_eval_runs`**:
   - `id`, `case_id`, `prompt_version_id`, `actual_decision` jsonb, `passed`, `diff` jsonb, `latency_ms`, `cost_usd`, `run_at`

3. **View `funnemail_brain_v`**:
   - Join `channel_messages` + `funnemail_jobs_v` + `funnemail_decisions` + `funnemail_actions_log` + `funnemail_message_reminders` + `email_classifications`
   - Una riga per message_id con tutto il contesto cognitivo

### Nuova edge function: `run-funnemail-eval`
- Input: `case_id` o `tags[]` o `all=true`, `prompt_version_id` opzionale
- Esegue caso contro pipeline corrente, confronta con expected, scrive `funnemail_eval_runs`
- Triggerabile da Prompt Lab e da CI

### UI
4. Pagina `/v2/email-intelligence/operations`:
   - Job timeline (live tail su `email_processing_jobs`)
   - SLA dashboard (decisioni > X minuti)
   - DLQ con retry
   - Costi AI per gruppo (da `ai_interaction_log`)
5. Tab "Eval Set" in Prompt Lab con run button e diff viewer

### Cron
6. `pg_cron` job notturno: esegue eval set su prompt attivo, alert Discord se pass-rate < 90%

---

## Dettagli tecnici trasversali

### Edge function — pattern obbligatorio per le nuove
```
auth (JWT utente o x-internal-token Vault)
→ Zod validation input
→ structured logging start
→ business logic con AbortController timeout 30s
→ structured logging end + edge_metrics
→ response con securityHeaders
```

### Token interno server-to-server
- Vault secret `funnemail_internal_token` (rotabile)
- Helper `_shared/internalAuth.ts`: `requireInternalOrUser(req)`

### Charter AI
- Nuovi scope da registrare in `ai_scope_registry`:
  `funnemail.policy_engine`, `funnemail.scout_cache_miss`, `funnemail.eval_runner`

### Test
- Ogni sprint: almeno 1 test E2E Playwright nuovo + test Deno unit per ogni edge nuova
- Coverage minima nuove edge: 70%

### Rollout
- Feature flag `funnemail_v2_enabled` per ogni sprint
- Tutti i nuovi path coesistono con vecchi finché flag off
- Cutover per-utente, non globale

---

## Cosa NON è in piano (già fatto o fuori scope)
- Prompt versioning + regression DB (già attivo: 161 versioni, runner esistente)
- Escalation L1/L2/L3 (esistente in `funnemail_escalation_events` + `funnemail-reminders-tick`)
- Osservabilità base (`edge_metrics` + `ai_interaction_log` esistono — manca solo la dashboard)
- Trigger `on_inbound_message` → classify (già attivato 2026-05-05)
- Dedup operative_prompts (già fatto 2026-05-05)

---

## Stima
- Sprint 1-2: P0 critici (sicurezza + fondamenta) → bloccare prima di tutto
- Sprint 3-4: valore commerciale (policy engine + qualità decisioni)
- Sprint 5: governance (eval + dashboard)
- Totale: 5 settimane se sequenziale, 3-4 con parallelismo controllato (S3 e S4 indipendenti)


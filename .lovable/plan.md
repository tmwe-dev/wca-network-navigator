# P0 — Consolidamento pipeline messaggi (Strangler)

Nota: **B0 è stato eseguito nel turno precedente**. Questo piano lo formalizza e propone i batch successivi. Nessuna riscrittura, tutti i batch reversibili con `git revert`.

## 1. Percorsi attivi (codice reale)

### Ingestione
- IMAP: `email-cron-sync` → `check-inbox` → INSERT `channel_messages` (direction=inbound).
- Sent: `email-sync-worker` → `channel_messages` (outbound).
- WA/LI: extension → `receive-channel-message` → `channel_messages`.

### Trigger classificazione (TRIPLICE — problema centrale)
```text
INSERT channel_messages ──► trigger on_inbound_message ──pg_net──► classify-inbound-message
check-inbox (fine batch) ──fetch──► classify-inbound-message  (max 10/sync)
cron 5m ─► classify-emails-batch ──fetch──► classify-inbound-message  (safety net)
```
Dedup: guard su `reply_classifications.message_id`.

### Orchestratore `classify-inbound-message`
```text
received → guard-injection → stage1 AI → stage2 Post → stage3 Funnemail → stage4 Content
```
| Stage | File | Scrive |
|---|---|---|
| 1 AI | `stages/stageClassifyAi.ts` | `reply_classifications`, `activities`, `ai_pending_actions` |
| 2 Post | `stages/stagePostClassification.ts` | `email_classifications` (via EmailProcessManager), `funnemail_actions_log` |
| 3 Funnemail | `stages/stageFunnemailPipeline.ts` | `funnemail_scout_cache`, `funnemail_message_status`, `email_address_rules` |
| 4 Content | `stages/stageContentAndContext.ts` | `email_content_intelligence`, `contact_conversation_context`, `alert_dispatch_log` |

### Generazione / Review / Send / Follow-up (invariati)
- Generazione: `improve-email`, `generate-email`, `generate-outreach`, `agent-execute`.
- Journalist review: enforced in `send-email`, `send-whatsapp`, `send-linkedin`, `process-email-queue`.
- Risk gate: `pending-action-executor` + SSOT `src/lib/messaging/*`.
- Reminder/follow-up: `smart-scheduler`, `funnemail_message_reminders`, `harmonizer_followups`.
- Feedback/learning: `ai_message_feedback`, `ai_edit_patterns`, `learn-from-group-correction`.
- Audit: `pipeline_traces`, `ai_interaction_log`, `ai_invocation_audit`.

## 2. Duplicazioni / SoT conflittuali

| # | Duplicazione | SoT candidato |
|---|---|---|
| D1 | Trigger DB + fetch check-inbox + cron batch | trigger DB (unico produttore) |
| D2 | `reply_classifications` vs `email_classifications` | `reply_classifications` esteso |
| D3 | `classify-email-response` orfano (deploy attivo, 0 caller) | delete post-verifica logs |
| D4 | 4 tabelle azione (`funnemail_actions_log`, `inbound_operative_actions`, `ai_pending_actions`, `email_address_rules`) | `ai_pending_actions` per esecuzione, altre per policy |
| D5 | Filtri newsletter (trigger SQL vs `email_address_rules`) | `email_address_rules` |
| D6 | Body extraction (`check-inbox/bodyExtractor` vs `email-imap-proxy`) | mantenere `check-inbox` (vincolo) |
| D7 | Prompt classificazione duplicati (già -20 in audit 2026-05-05) | `operative_prompts` attivi |

## 3. Contratto canonico

`src/v2/core/domain/messageIntelligence.ts` — `MessageIntelligenceResult`:
- id + user + channel + correlation_id (= message_id, deterministico).
- classification, confidence, sentiment, urgency, intent, reasoning, model.
- estensioni B1: category, sender_group_id, folder_hint, policy_plan[], triage.
- Produttore unico: `classify-inbound-message`. Vista lettura (B3): `public.message_intelligence_v`.

## 4. Scelte canoniche motivate

- **Classificatore**: `classify-inbound-message`. Già multicanale, già SSOT nel trigger DB, ha stages modulari, è l'unico che scrive dedup gate.
- **Tabella stato**: `reply_classifications` (estesa additivamente). Motivi: chiave dedup già in uso, colonne base allineate al contratto, minor blast radius vs migrare consumer di `email_classifications`.
- **Correlation ID**: `message_id` (channel_messages.id). Deterministico, join-friendly, evita generatori paralleli.

## 5. Piano Strangler

### B0 — Osservabilità (COMPLETATO turno precedente)
Header `x-invoke-source` sui 2 caller HTTP + tracer step `classify_inbound:dedup_hit` + contratto TS + script baseline + doc mappa.

### B1 — Estensione additiva schema (solo ADD COLUMN, nullable)
Migration su `reply_classifications`: `category`, `sender_group_id`, `folder_hint`, `policy_plan jsonb`, `triage jsonb`, `canonical_version int default 1`.
GRANT invariati. RLS invariata. Nessuno stage scrive ancora questi campi.

### B2 — Populate parallela (dual-write nello stesso orchestratore)
`stageClassifyAi.ts` popola i nuovi campi in aggiunta a quelli esistenti. `stagePostClassification` continua a scrivere `email_classifications` (nessuna rimozione). Feature flag `MESSAGE_INTELLIGENCE_V1_ENABLED` (default on) per rollback via env.

### B3 — Vista canonica read-only
`create view public.message_intelligence_v` JOIN `channel_messages` + `reply_classifications`. GRANT SELECT authenticated. Consumer UI v2 (nuovi hook) leggono da qui.

### B4 — Migrazione consumer UI verso vista
Un hook alla volta (`useChannelMessagesV2` prima, poi email intelligence, poi Funnemail inbox). Nessuna rimozione di `email_classifications` reads.

### B5 — Rimozione fallback ridondanti (solo dopo gate misurato)
Dopo report baseline B0 (7gg) che soddisfa i criteri: rimuovi fetch in `inboxPostProcess.ts` (D1). `cron-batch` resta come safety net.

### B6 — Cleanup orfani
Delete `classify-email-response` + prompt duplicati residui + rotta legacy `email_classifications` (solo se 0 reader dopo B4).

## 6. Test, rischi, rollback

**Test obbligatori prima di ogni batch** (già esistenti):
- `e2e/funnemail-classify-pipeline.spec.ts`, `e2e/email-inbound-to-task.spec.ts`, `e2e/inbound-direction-filter.spec.ts`, `e2e/editorial-review-block.spec.ts`, `e2e/realtime-channel-messages.spec.ts`.
- Unit: `src/test/messaging-ssot-governance.test.ts`, `supabase/functions/_shared/contentNormalizer.test.ts`.
- Baseline B0: `deno run -A scripts/report-classify-dedup.ts` per 7 gg prima di autorizzare B5.

**Rischi per batch**:
- B1: nullo (ADD COLUMN nullable).
- B2: dual-write può aumentare latenza stage1 (~5-20ms). Mitigazione: campi in stesso INSERT, nessun round-trip extra.
- B3: view sotto stima costi → LIMIT esplicito nei consumer.
- B4: regressione UI → migrare 1 hook per PR con snapshot test.
- B5: perdita messaggi se trigger DB fallisce silenziosamente → mantenere cron 5m come safety net finale.
- B6: hardcoded caller nascosto → `rg` esaustivo + smoke E2E prima del delete.

**Rollback**:
- B1: `alter table drop column ...`.
- B2: env flag off.
- B3: `drop view`.
- B4: git revert singolo hook.
- B5/B6: git revert; il codice cancellato torna al deploy successivo.

**Criteri di successo P0**:
- `dedup_hits/invocations` da postProcess ≥ 60% → conferma trigger DB copre;
- 0 regressioni sui 5 E2E citati;
- `channel_messages.classification` letto solo da 1 fonte (view canonica) al termine B4.

## 7. Primo batch a rischio minimo — B1 (post-B0)

Solo migration additiva. **File da creare**:
- `supabase/migrations/<timestamp>_reply_classifications_canonical_v1.sql`
  ```sql
  ALTER TABLE public.reply_classifications
    ADD COLUMN IF NOT EXISTS category text,
    ADD COLUMN IF NOT EXISTS sender_group_id uuid REFERENCES public.email_sender_groups(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS folder_hint text,
    ADD COLUMN IF NOT EXISTS policy_plan jsonb,
    ADD COLUMN IF NOT EXISTS triage jsonb,
    ADD COLUMN IF NOT EXISTS canonical_version integer NOT NULL DEFAULT 1;
  CREATE INDEX IF NOT EXISTS idx_reply_classifications_sender_group_id
    ON public.reply_classifications(sender_group_id);
  ```
  (nessun GRANT nuovo — tabella già esistente; RLS/policies invariate).

**File da modificare**: nessuno (0 codice runtime cambia; consumer non usano ancora i nuovi campi).

**Verifica post-migration**: `supabase--linter` + query di sanity su count righe pre/post identico.

## Vincoli rispettati
- `check-inbox`, `email-imap-proxy`, `mark-imap-seen`, `journalistReview` non toccati in nessun batch.
- Nessun nuovo classificatore/scheduler/tabella-parallela — solo estensione della SSOT esistente.
- Riuso `pipeline_traces` (tracer esistente), `invokeAi` charter, `pending-action-executor` (risk gate), `ai_interaction_log`.
- Se doc `mem/` diverge dal codice: il codice vince (già documentato in `docs/audit/message-pipeline-2026-07-20.md`).
- Nessuna riscrittura generale: 6 batch, ognuno < 1 giornata, ognuno reversibile.

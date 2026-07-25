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

## Batch B2 — popolamento additivo campi canonici (COMPLETATO)

**Modifica minima e localizzata** all'orchestratore SSOT
`classify-inbound-message`, riutilizzo integrale del mapper esistente
`mapInboundToEmailCategory`, zero round-trip DB extra, zero nuove chiamate AI.

**File modificati**
- `supabase/functions/classify-inbound-message/stages/canonicalFields.ts` (nuovo, puro, 45 LOC)
  - `buildCanonicalExtension({ classification })` → riusa mapper esistente per `category`.
  - `isMessageIntelligenceV1Enabled(env)` → gate `MESSAGE_INTELLIGENCE_V1_ENABLED === "true"`.
- `supabase/functions/classify-inbound-message/stages/stageClassifyAi.ts`
  - `persistClassificationSideEffects`: costruisce `insertPayload` legacy, poi se flag ON fa `Object.assign` con l'estensione canonica. Flag OFF ⇒ payload byte-identico al pre-B2.
- `src/v2/core/domain/__tests__/canonicalFields.test.ts` (nuovo, 6 test verdi).

**Campi popolati oggi (flag ON)**
| Campo | Valore in B2 | Popolato in |
|---|---|---|
| `category` | derivato da `mapInboundToEmailCategory(classification)` | B2 |
| `sender_group_id` | `null` | B3 (via funnemail-auto-route side-effect) |
| `folder_hint` | `null` | B3 (via funnemail-classify side-effect) |
| `policy_plan` | `null` | B4 (via funnemail-policy-engine side-effect) |
| `triage` | `null` | B4 (via runTriageAndAlert stage 4) |
| `canonical_version` | `1` | B2 |

**Attivazione / disattivazione flag**
- Attivare: aggiungere secret Edge Function `MESSAGE_INTELLIGENCE_V1_ENABLED=true` in Project Settings → Secrets, poi ridispiegare `classify-inbound-message`.
- Disattivare: eliminare la secret (o impostare qualsiasi valore ≠ `"true"`) e ridispiegare. Comportamento torna identico al pre-B2 senza migration.
- Rollback totale: `git revert` sui 3 file. Nessun dato pregresso viene toccato (i record già scritti restano con i nuovi campi valorizzati o `NULL` invariati).

**Rischi residui**
- Se il mapper `mapInboundToEmailCategory` cambia in futuro, cambia anche `category` scritto: accettabile (SSOT unica).
- `sender_group_id`, `folder_hint`, `policy_plan`, `triage` restano `NULL` finché non parte B3/B4: consumer devono trattarli come opzionali (già previsto nel contratto `MessageIntelligenceResult`).

**Prove**
- 6/6 test vitest verdi (`canonicalFields.test.ts`): flag OFF (default), flag ON, mapping deterministico, campi null attesi.
- `tsgo --noEmit` verde.
- Diff funzionale: solo `stageClassifyAi.ts` (payload esteso via Object.assign gated) + 1 modulo puro nuovo + 1 test. Nessuna modifica a `check-inbox`, `email-imap-proxy`, `mark-imap-seen`, `journalistReview`, cron, trigger DB, RLS, migrations, UI.

---

## Batch B2 — ATTIVAZIONE (2026-07-20)
- Secret Edge Functions `MESSAGE_INTELLIGENCE_V1_ENABLED=true` impostata → orchestratore `classify-inbound-message` popola i campi canonici sui prossimi INSERT su `reply_classifications` senza toccare le colonne legacy.
- Rollback: rimuovere/impostare a `false` la secret e ridispiegare `classify-inbound-message`.

## Batch B3 — VIEW CANONICA READ-ONLY (2026-07-20)
- Creata `public.message_intelligence_v` con `WITH (security_invoker = true)`.
- JOIN LATERAL: 1 riga per `message_id` = classificazione più recente (`ORDER BY reply_classifications.created_at DESC LIMIT 1`).
- `correlation_id = message_id`. Espone: base messaggio (channel_messages) + campi canonici v1 (category/sender_group_id/folder_hint/policy_plan/triage/canonical_version) + campi legacy classificazione.
- GRANT SELECT solo a `authenticated` e `service_role`. Nessun grant `anon`. Nessun bypass RLS: SECURITY INVOKER eredita policy `channel_messages_select_own` + `Owner reads own reply classifications`.
- Verifica: `count(*) = count(distinct message_id) = 8563` → nessun duplicato.
- Nessuna mutazione, trigger, materialized view, backfill. Nessuna modifica a UI/hook/consumer. `email_classifications` e fallback restano invariati.
- Rollback: `DROP VIEW public.message_intelligence_v;`.

Stato piano P0: **B0 ✅ + B1 ✅ + B2 ✅ + B3 ✅**. B4–B6 non iniziati.

## Batch B4.1 — Consumer migration `useChannelMessagesV2` (2026-07-20, corretto)
- **Correzione view (B3-fix)**: `message_intelligence_v` ricreata con `LEFT JOIN LATERAL` a `reply_classifications` — ora espone TUTTI i messaggi (18763 righe = `channel_messages`, una per `id`, incluse le 10186 non ancora classificate). Aggiunti campi reali: `to_address`, `body_text`, `body_html`, `partner_id`, `read_at`, `message_category` (category originale di `channel_messages`, distinta dalla `category` AI di `reply_classifications`). `security_invoker=true`, grant invariati (`authenticated`, `service_role`, no anon). Nessun DROP distruttivo: verificate zero dipendenze.
- `fetchChannelMessagesFromView` seleziona e mappa i campi reali (nessun `null` inventato). Rimosso il cast `supabase as any`: la view è tipizzata in `Database["public"]["Views"]`. `category` del `ChannelMessage` = `message_category`.
- `useChannelMessagesV2`: primaria = view; fallback trasparente = `fetchChannelMessages` legacy solo su errore/indisponibilità. Log strutturato senza PII.
- Query key `queryKeys.v2.channelMessages(direction, limit)` invariata → invalidation post `markRead` preservata.
- Consumer reali dell'hook: **0** (verificato con rg). Zero impatto UI.
- Test: 4 DAL (classificato con tutti i campi preservati, non classificato presente con rc.* null, view Err → Err per orchestrazione, legacy invariato) + 2 hook (view Ok = no legacy call, view Err = fallback legacy). Vitest 12/12 verdi (B2 + B4.1).
- Rollback: revert dei 4 file TS + migration `DROP VIEW public.message_intelligence_v; CREATE VIEW ...` con la definizione precedente (INNER JOIN, solo classificati).

Stato piano P0: **B0 ✅ + B1 ✅ + B2 ✅ + B3 ✅ + B4.1 ✅ (corretto)**. B4.2 / B5 / B6 non iniziati.

## Batch B4.2 — Consumer migration `HistoryTab` + semplificazione DAL (2026-07-21)

- **API pubblica unica**: `fetchRecipientHistory(filter)` in `src/v2/io/supabase/queries/channel-messages.ts`. Helpers `queryRecipientHistoryFromView` / `queryRecipientHistoryFromLegacy` privati (non esportati). Il fallback trasparente è centralizzato nel DAL: prova view canonica → su `Err` logga senza PII (`code` only, via `createLogger("dal:recipient-history")`) e ricade su `channel_messages`.
- **Consumer**: `src/v2/ui/pages/email-forge/tabs/HistoryTab.tsx` importa SOLO `fetchRecipientHistory` + `RecipientHistoryRow`. Rimossi `fetchRecipientHistoryFromView`, `createLogger`, il warn locale e la doppia gestione `isOk`. UI, filtri, query key, ordine DESC, limit 10, precedenza `partnerId`, OR ILIKE su email invariati.
- **LOC DAL**: da ~95 LOC (2 API pubbliche + 2 blocchi try/catch duplicati) a ~80 LOC (1 API pubblica + 2 helper privati + 1 orchestratore). LOC HistoryTab: -8 (rimossi logger, import view, branch legacy).
- **Test end-to-end** dell'API pubblica in `src/v2/io/supabase/queries/__tests__/recipient-history.test.ts` (6/6 ✅): (1) nessun filtro → nessuna query; (2) view OK non chiama legacy + filtri/ordine/limit/alias corretti; (3) solo email → OR ILIKE; (4) partnerId precede email; (5) view Err → fallback trasparente su legacy con ordine/limit legacy; (6) entrambe Err → propaga Err. Eliminati i test duplicati sulle API oggi private.
- **Verifiche**: Vitest 16/16 ✅ (B2 + B4.1 + B4.2). `tsgo` verde. Nessuna migration/view/RLS/AI/cron/invio/scheduler/altro consumer toccati.
- **Rischio**: minimo. Il fallback resta identico a prima, ma è ora invisibile al chiamante → nessun consumer può dimenticarsi di gestirlo.
- **Rollback**: `git revert` di 3 file (DAL, HistoryTab, test).

Stato piano P0: **B0 ✅ + B1 ✅ + B2 ✅ + B3 ✅ + B4.1 ✅ + B4.2 ✅**. B5 / B6 non iniziati.

## Batch B4.3 — Consumer migration `ExportSendersDialog` (2026-07-25)

- **Consumer scelto**: `src/components/email-intelligence/management/ExportSendersDialog.tsx` — pannello di export CSV dei messaggi di N mittenti nella sezione Email Intelligence. Zero realtime, zero mutation, zero paginazione iterativa, singola query on-demand con `channel="email"` + `in from_address` + `order email_date DESC` + `limit 2000`. Nessuna intersezione con Funnemail Inbox.
- **API DAL nuova (pubblica)**: `fetchMessagesBySenders(senders, limit=2000)` in `src/v2/io/supabase/queries/channel-messages.ts`. Helpers `querySenderMessagesFromView` / `querySenderMessagesFromLegacy` privati. Primaria = `message_intelligence_v` (alias `id:message_id`), fallback trasparente centralizzato nel DAL su `channel_messages` con log strutturato senza PII (`sender_messages_view_fallback`, solo `code`).
- **Prima**: `supabase.from("channel_messages").select("id, email_date, direction, from_address, to_address, subject, body_text").eq("channel","email").in("from_address", senderEmails).order("email_date", { ascending: false }).limit(2000)`.
- **Dopo**: `const result = await fetchMessagesBySenders(senderEmails, 2000);` — filtri, ordinamento, limit, mapping CSV, toast di successo/errore, comportamento UI (RadioGroup, bottone, loader, chiusura dialog) invariati. Rimosso `import { supabase }` dal componente.
- **Test** (`src/v2/io/supabase/queries/__tests__/sender-messages.test.ts`, 4/4 ✅):
  1. nessun mittente → nessuna query, `Ok([])`.
  2. view OK → legge dalla view, non chiama legacy, verifica select/eq/in/order/limit e alias `id:message_id`.
  3. view Err → fallback trasparente su `channel_messages` con stessi filtri/ordine/limit.
  4. view Err + legacy Err → propaga `Err`.
- **Verifiche**: Vitest 22/22 ✅ (B2 + B4.1 + B4.2 + B4.3). `tsgo --noEmit` verde. Nessuna migration/view/RLS/grant/Edge Function/AI/classificatore/cron/invio/scheduler/prompt/agente. Nessuna modifica a Funnemail Inbox né ad altri consumer.
- **Rischio**: minimo. Fallback identico al percorso pre-B4.3 e ora invisibile al chiamante → nessun consumer può dimenticarlo. Perimetro = un solo dialog di export on-demand.
- **Rollback**: `git revert` di 3 file (`channel-messages.ts`, `ExportSendersDialog.tsx`, `sender-messages.test.ts`).

Stato piano P0: **B0 ✅ + B1 ✅ + B2 ✅ + B3 ✅ + B4.1 ✅ + B4.2 ✅ + B4.3 ✅**. B5 / B6 non iniziati.

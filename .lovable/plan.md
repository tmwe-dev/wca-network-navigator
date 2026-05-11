
# Piano operativo — 4 interventi su email pipeline e prompt governance

Quattro blocchi indipendenti, atomici, ordinati per dipendenza. Ogni blocco è auto-contenuto e reversibile (no big-bang).

---

## Blocco 1 — Import prompt avanzati dal docx in `operative_prompts` (con versioning)

**Cosa**: inserire 2 prompt OBBLIGATORIA come prima ondata, con snapshot in `prompt_versions` (trigger già attivo).

**Prompt importati (Wave 1 di 15)**:
1. **Funnemail Classifier** — context: `funnemail_classifier`, tags: `[OBBLIGATORIA, classification, inbound]`, priority **100**
2. **Quality Gate / Verificatore** — context: `email-quality`, tags: `[OBBLIGATORIA, quality-gate, output-format]`, priority **100**

**Formato**: template "Professore" (Identità / Obiettivo / Metodo / Guardrail / Output JSON) — vedi `docs/prompt-standard.md`.

**Output Quality Gate**: `verdict: "pass" | "pass_with_edits" | "block"`, `edited_text`, `warnings[]`, `quality_score`, `reasoning_summary` — coerente con contratto di `journalistReviewLayer.ts` e `reviewMessage.ts`.

**Output Funnemail Classifier**: `intent`, `category`, `domain`, `urgency`, `sentiment`, `channel_suggested`, `next_action`, `confidence` — coerente con `classify-inbound-message`.

**Migrazione**:
- `INSERT` in `operative_prompts` con `user_id` = NULL (globali) o per ciascun owner attivo (decisione: globali + override per-utente possibile in seguito).
- Nessun deprecato di prompt esistenti in questa wave (solo additivo). Eventuali duplicati funzionali verranno soft-deprecati in Wave 2 dopo verifica eval.
- Trigger DB esistente crea automaticamente lo snapshot in `prompt_versions`.

**Test regressione**: aggiunti 2 `prompt_test_cases` (uno per Quality Gate "block" su email con superlativi vuoti, uno per Funnemail Classifier su quote_request) — eseguibili via `prompt-test-runner`.

**Wave 2 (NON in questo piano, solo annotata)**: gli altri 13 prompt della doctrine — da inserire dopo che Wave 1 ha girato 48h con metriche stabili.

---

## Blocco 2 — Riparazione pipeline inbound (cablaggio policy executor)

**Diagnosi attuale**:
- `classify-inbound-message` chiama già `funnemail-scout-sender` → `funnemail-classify` → `funnemail-auto-route` (Stage 3).
- **Manca**: `funnemail-auto-route` → `funnemail-policy-engine` → `funnemail-policy-executor`. Oggi l'auto-route produce decisioni ma le azioni non vengono eseguite idempotentemente.
- `check-inbox/postProcessing.ts:64` filtra ancora `raw_payload.direction === "inbound"` (campo top-level) → bypass legacy.

**Fix**:
1. **Cablaggio policy** in `classify-inbound-message`: dopo `runFunnemailAutoRoute`, aggiungere `runFunnemailPolicyPipeline(supabase, body, result, recordStage)` che:
   - chiama `funnemail-policy-engine` (resolve policy + plan azioni)
   - per ogni azione del piano chiama `funnemail-policy-executor` con `idempotency_key` = `${message_id}:${action_type}`
   - log stage = `policy_applied` su `email_processing_jobs`
   - fail-soft: errori loggati ma non bloccanti
2. **Fix filtro `postProcessing.ts:64`**: cambiare `raw_payload.direction` → `direction` (top-level). Una sola riga, alto impatto.
3. **Telemetria**: garantire che ogni stage scriva su `email_processing_jobs` (received → scouted → classified → routed → policy_applied → completed). Già parzialmente coperto, completare gli stage mancanti.

**Hard guard**: nessuna azione `draft_reply` o `autoresponder` viene davvero eseguita dal policy executor (resta delega a generate-email/funnemail-send-autoresponder che hanno journalistReview o eccezione template-only). Comportamento esistente preservato.

**Verifica**: query post-deploy — `SELECT stage, count(*) FROM email_processing_jobs WHERE created_at > now() - interval '1 day' GROUP BY 1` per confermare che ≥80% raggiunga `completed`/`policy_applied`.

---

## Blocco 3 — Handler mancanti in `postClassificationPipeline`

**Diagnosi**: 16 categorie commerciali enumerate in `ClassificationCategory` ma non gestite dallo `switch` di routing commerciale (linee 181–278). Oggi cadono nel default → nessuna azione.

**Categorie senza handler**: `quote_request`, `booking_request`, `rate_inquiry`, `shipment_tracking`, `cargo_status`, `documentation_request`, `invoice_query`, `payment_request`, `payment_confirmation`, `credit_note`, `account_statement`, `service_inquiry`, `technical_issue`, `feedback`, `newsletter`, `system_notification`.

**Strategia**: NON creare 16 handler dedicati (rischio bloat). Raggruppare in **5 handler tematici**, ognuno crea una `ai_pending_action` con `action_type` e `requires_approval` corretti:

| Handler | Categorie | action_type pending |
|---|---|---|
| `handleQuoteOrBooking` | quote_request, booking_request, rate_inquiry | `prepare_quote` (requires_approval: true) |
| `handleShipmentOps` | shipment_tracking, cargo_status, documentation_request | `lookup_shipment` (requires_approval: false, esegue subito) |
| `handleFinancialQuery` | invoice_query, payment_request, payment_confirmation, credit_note, account_statement | `financial_review` (requires_approval: true, escalation a admin) |
| `handleServiceOrSupport` | service_inquiry, technical_issue, feedback | delega a `handleQuestion` esistente con tag `service` |
| `handleNoise` | newsletter, system_notification | log + skip (no action, marker per learning loop) |

**Implementazione**:
- Nuovo file `_shared/commercialCategoryHandlers.ts` (LOC budget <200) con i 5 handler.
- Switch in `postClassificationPipeline.ts` esteso: aggiunte 16 nuove `case` che chiamano i 5 handler.
- Nessuna chiamata diretta ad AI: tutti gli handler creano solo `ai_pending_actions` (azione differita), il draft eventuale resta delegato a generate-email passando per journalistReview (vedi Blocco 4).

**Sicurezza**: nessun handler invia messaggi diretti. Tutte le azioni che producono outbound passano da `ai_pending_actions` → `pending-action-executor` → orchestratori che già hanno journalistReview.

---

## Blocco 4 — Chiusura bypass `journalistReview` su `generateReplyDraft`

**Diagnosi**: 4 callsite di `generateReplyDraft` in `_shared/`:
- `emailRouter.ts:127` (handleInterested)
- `emailRouter.ts:276` (handleFollowUp / send_graceful_close)
- `questionAndComplaintHandler.ts:76` (reply_to_question)
- `questionAndComplaintHandler.ts:150` (handle_complaint)

`generateReplyDraft` chiama `aiChat` direttamente e scrive `draft_subject`/`draft_body` in `ai_pending_actions.action_payload` **senza passare da `journalistReview`**. Quando l'operatore approva, il draft va in send-* dove journalistReview gira come gate finale (già OK), ma **l'operatore vede già un draft non revisionato**, rischiando approvazione di contenuto di bassa qualità.

**Fix minimale, locale, reversibile**:
1. In `generateReplyDraft` (un solo punto), dopo che l'AI produce `draft_body`, chiamare `journalistReview({ draft: draft_body, channel: "email", partnerId, contactId, mode: "review_and_correct" })`:
   - `verdict === "block"` → NON salvare il draft, scrivere in `action_payload.draft_blocked = true` + `block_reason`. L'operatore vedrà la pending action con badge "draft bloccato dal Quality Gate" e potrà comporre manualmente.
   - `verdict === "pass_with_edits"` → salvare `edited_text` invece dell'originale, marker `draft_reviewed_at`.
   - `verdict === "pass"` → salvare originale, marker `draft_reviewed_at`.
   - errore LLM → fail-open (salva originale + warning, parità con pattern esistente in `send-email`).
2. Aggiungere flag `journalist_reviewed: true` nel payload così send-email NON ri-revisiona (anti doppia review, già pattern coperto in memoria).
3. Test regressione: estendere `src/test/journalist-pipeline-coverage.test.ts` con 1 caso che verifica che `generateReplyDraft` invochi `journalistReview` e gestisca i 3 verdict.

**Niente refactor opportunistici**: la firma pubblica di `generateReplyDraft` resta identica, solo aggiunta interna del gate. Tutti i 4 caller continuano a funzionare invariati.

---

## Ordine di rollout

1. **Blocco 1** (prompt + test) — additivo, zero rischio.
2. **Blocco 4** (gate su generateReplyDraft) — usa Quality Gate appena importato.
3. **Blocco 3** (handler 16 categorie) — popola pending actions, alcune produrranno draft via Blocco 4.
4. **Blocco 2** (cablaggio policy executor + fix filtro) — abilita la pipeline a girare sulla maggioranza delle inbound.

Ogni blocco ha changelog separato in `mem/reference/` e può essere rollback-ato indipendentemente (Blocco 1 = soft-deprecate; Blocco 2 = revert cablaggio; Blocco 3 = revert switch case; Blocco 4 = revert wrapper).

## Out of scope (esplicito)

- Wave 2 dei 13 prompt restanti (Anima del messaggio, Customer story, ecc.) — fase successiva.
- Riarchitettura `check-inbox` per usare `invokeAi` charter (debito noto, non in questo piano).
- Consolidamento `email_classifications` legacy → `ai_interaction_log`.
- Dashboard metriche pipeline inbound.

## Dettagli tecnici

- **DB**: nessuna nuova tabella. Migrazioni solo `INSERT` in `operative_prompts` + `prompt_test_cases`.
- **Edge functions modificate**: `classify-inbound-message`, `_shared/postClassificationPipeline.ts`, `_shared/classificationRules.ts`, `check-inbox/postProcessing.ts`.
- **Edge functions nuove**: nessuna (`funnemail-policy-engine`/`-executor` già esistono).
- **Nuovi file**: `_shared/commercialCategoryHandlers.ts`, `_shared/funnemailPolicyPipeline.ts`.
- **Test**: 2 nuovi `prompt_test_cases` + 1 nuovo test in `journalist-pipeline-coverage.test.ts`.
- **Sicurezza**: nessun cambiamento RLS, nessun bypass JWT, idempotency_key su tutte le azioni policy.

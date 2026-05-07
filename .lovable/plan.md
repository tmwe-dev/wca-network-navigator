
## Comparazione audit esterno vs roadmap interna

L'audit esterno (`audit_funny_mail`) è **complementare**, non in conflitto. Mappa:

| Audit esterno | Roadmap interna | Stato |
|---|---|---|
| Gap 6 — Triage sanitizer | T1 (`normalizeSanitizeAndWrap` su inboundTriage) | ✅ già fatto |
| Prompt registry / Prompt Lab | T2 + S3 (loader + Professore template) | ✅ già fatto / in corso |
| Gap 4 — Stati/sub-status | S1 (folders mancanti) parziale | 🟡 da estendere |
| Next-step obbligatorio (Gap 2) | — non previsto | ➕ NUOVO |
| Job unico / vista aggregata (Gap 1) | — non previsto | ➕ NUOVO |
| Escalation multilivello (Gap 3) | Cr3 hook lead status, parziale | ➕ ESTENDERE |
| Guard dominio auto-route | — non previsto | ➕ NUOVO |
| Golden dataset + metriche P/R/F1 | C3 (struttura + import CSV) | ✅ allineato |
| Drift edgeFnPromptRegistry | — non previsto | ➕ NUOVO P3 |
| Strict JSON funnemail-scout/content | C4/S2 | ✅ già pianificato |

Conclusione: tre temi nuovi (P1) da incorporare nelle fasi STANDARD/CRITICAL — **next-step obbligatorio**, **vista job aggregata**, **escalation multilivello con domain guard**.

## Piano integrato (delta sulla roadmap già approvata)

### TRIM (completare ciò che resta)
- T2 bis — Spostare anche `Operative Dispatcher Routing` e `Group-Aware Classification` a Professore template (già parziale). Verificare che `edgeFnPromptRegistry` punti al loader dinamico, non alle copie statiche → marcare static come `legacy_fallback_only`.
- T3 bis — Aggiungere regola obbligatoria al system prompt `Inbound Message System` e `Funnemail Classifier`:
  > "Se la mail è rilevante, devi sempre produrre almeno un `next_step` (action_type, owner_role, urgency, due_in_hours, reason, status=open). Altrimenti devi indicare `closure_reason`."

### STANDARD (estensioni audit esterno)
- S5 (NUOVO) — **Next-step enforcement**: Zod schema in `classify-inbound-content` aggiunge `next_step | closure_reason` come union obbligatoria. Edge function rifiuta output senza uno dei due (fallback safe → marca `requires_human_review`).
- S6 (NUOVO) — **Domain guard auto-route**: lista `generic_domains` (gmail, outlook, libero, hotmail, yahoo, …) caricata da DB (`funnemail_routing_config`) → su questi domini soglia confidence sale a 0.95 e auto-route disabilitata se sender non ha già almeno 1 partner_id mappato.
- S7 (NUOVO) — **Sub-status job**: aggiunta enum `funnemail_job_substatus` (`unassigned`, `assigned`, `in_progress`, `waiting_external`, `waiting_internal`, `blocked`, `closed_done`, `closed_dropped`) sulla tabella stati esistente, senza rompere lo schema attuale (campo nullable + default mapping).

### CRITICAL (nuovi)
- Cr4 (NUOVO) — **Vista `funnemail_jobs_v`** (read-only) che aggrega per `message_id`: claim, status, sub_status, reminders aperti, pending actions, alert dispatched, owner, due_at calcolato come `min(reminder.due_at, alert.escalate_at)`. Niente nuova tabella: solo VIEW + indici sulle FK già esistenti. Esposta via DAL `src/data/funnemailJobs.ts`.
- Cr5 (NUOVO) — **Escalation multilivello**: estensione `funnemail-reminders-tick` (NON tocca check-inbox/imap):
  - L1 = reminder al claim owner.
  - L2 = se non preso entro `escalation_l2_minutes` (default 30 per P1 urgent) → notifica admin + log `escalation_events`.
  - L3 = se ancora aperto dopo `escalation_l3_minutes` (default 120) → broadcast WhatsApp via `dispatch-urgent-alert` con flag `escalation: true`.
  - Tabella `funnemail_escalation_events(message_id, level, dispatched_at, reason, target_user_id)` per audit.
- Cr6 (NUOVO) — **Drift check Prompt Registry**: edge function `prompt-registry-drift-check` (cron daily) compara hash dei prompt in `operative_prompts` vs snapshot statici in `edgeFnPromptRegistry`. Su drift → record in `prompt_test_runs` con `status=drift_warning`.

### Cr1 / C1 (autoresponder) — invariato, attende decisione utente.

## Guardrail (invariati)
- Nessuna modifica a `check-inbox`, `email-imap-proxy`, `mark-imap-seen`, `journalistReviewLayer`.
- Tutto via `supabase--migration` / `supabase--insert`. Soft-delete enforced.
- Nessuna nuova invocazione AI fuori da `invokeAi()` + scope registrato.
- Le 3 viste/tabelle nuove (`funnemail_jobs_v`, `funnemail_escalation_events`, `funnemail_routing_config`) con RLS standard (`has_role` + ownership).

## Verifica post-fase
- `prompt-test-runner` su 6 casi golden esistenti (RFQ urgent, ops urgent, invoice, partner supply, interest, newsletter).
- `supabase--curl_edge_functions` su `funnemail-reminders-tick` con seed forzato L2/L3.
- Smoke E2E: `e2e/alert-routing-flow.spec.ts` esteso con scenario "non preso in carico → escalation L2".

## Ordine di esecuzione proposto
1. T2 bis + T3 bis (regola next-step nel prompt) — zero migrazioni.
2. S5 next-step enforcement + S6 domain guard (1 migration: `funnemail_routing_config`).
3. Cr4 vista `funnemail_jobs_v` (1 migration: VIEW + DAL).
4. Cr5 escalation (1 migration: `funnemail_escalation_events` + estensione tick).
5. S7 sub-status + Cr6 drift check (1 migration finale).
6. Cr1 autoresponder — solo dopo decisione (a/b/c).

Tre questioni bloccanti restano sul tavolo: (1) opzione autoresponder C1, (2) ok preparare struttura golden dataset C3, (3) eseguire tutto in pass unico o spezzato fase-per-fase.

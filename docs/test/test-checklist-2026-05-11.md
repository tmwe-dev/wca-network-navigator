# Checklist Test Sistemica — 2026-05-11

Riferimento operativo per testare l'app a 5 livelli, dal flusso email base fino ai bridge esterni.
Vedi anche: `/v2/pipeline-traces` per la timeline live di ogni procedura.

## Principi

1. **Dry-run prima di prod** — replay su dati esistenti senza side-effect (no auto-route, no escalation).
2. **Un livello alla volta** — non testare classificazione + escalation + agenda insieme.
3. **Atteso vs reale** — definisci esito atteso per N email/contatti, l'AI gira, confronta.
4. **Kill-switch attivo** — `AI_USAGE_LIMITS_ENABLED=false` resta off, ma "shadow mode" deve bloccare write su tabelle business.
5. **Audit trail** — ogni run scrive in `pipeline_traces` (timeline) + `prompt_test_runs` (regressioni prompt).

---

## 🔴 Livello 1 — Pipeline Email

- [ ] **IMAP Download**: ogni mailbox configurata scarica nuove mail; bounce auto-rilevati.
      Verifica: `email_send_log` (status=`bounced`), edge `check-inbox`/`check-inbox-booking` logs.
- [ ] **Classificazione**: ogni inbound passa da `classify-inbound-message`.
      Verifica: `reply_classifications` popolato; trace su `/v2/pipeline-traces` mostra step `classify_inbound:ai`.
- [ ] **Auto-routing**: ≥0.85 confidence crea rule in `email_address_rules`; 0.60-0.85 solo suggerimento.
      Verifica: `funnemail-auto-route` logs + `channel_messages.ai_classification_suggestion`.
- [ ] **Escalation lead status**: risposte commerciali aggiornano `partners.lead_status` via `applyLeadStatusChange`.
      Verifica: `lead_status_changes` audit log.
- [ ] **Bounce handling**: hard/soft bounce → suppression e penalità mittente.

## 🟠 Livello 2 — Agenda & Decisione

- [ ] **Agenda placement**: AI piazza azione nel giorno corretto, raggruppata per tipo (4 sezioni).
- [ ] **Holding pattern**: contatti ✈️ pulsano e bloccano azioni come da governance.
- [ ] **Same-Location Guard**: non manda 2 outreach allo stesso paese in N giorni.

## 🟡 Livello 3 — Outreach

- [ ] **Generate-email/outreach** carica KB + persona + operative prompt corretti.
- [ ] **Editorial review obbligatorio**: ogni email/WA/LI passa da `journalistReview` (no eccezioni se non autoresponder template-only).
- [ ] **A/B test**: variante A vs B salvata correttamente, metriche aperture/click distinte.
- [ ] **Idempotency**: stesso `idempotency_key` non genera doppi invii.

## 🟢 Livello 4 — Governance

- [ ] **AI Invocation Charter**: ogni chiamata AI da frontend ha `scope` e `context.source`.
      Verifica: `ai_interaction_log`.
- [ ] **Prompt Lab**: modifiche a operative_prompts/personas si propagano senza redeploy.
- [ ] **Soft-delete**: nessun DELETE fisico; trigger DB converte in `deleted_at`.
- [ ] **Sovrapposizioni decisionali**: identifica casi dove 2 sistemi (es. Funnemail + classify-email-response) decidono la stessa cosa. Documenta priorità.

## 🔵 Livello 5 — Bridge Esterni

- [ ] **WhatsApp**: extension sync, dispatch via `extension_dispatch_queue`.
- [ ] **LinkedIn**: solo `from-webapp-li`; Partner Connect respinge LI-action (`LI_DELEGATED`).
- [ ] **WCA Bridge**: discover/scrape/enrich/verify passano da `gateAndMark` checkpoint.

---

## Strumenti di osservazione

| Cosa | Dove |
|---|---|
| Timeline passo-passo per email | `/v2/pipeline-traces` (cerca per trace_id = message_id) |
| Storico chiamate AI con thumbs up/down | `/v2/ai-interactions-log` |
| Test prompt regressione | `/v2/prompt-lab/tests` |
| Audit governance | `supervisor_audit_log` (DB) |
| Metriche edge function | `edge_metrics` (DB) |
| Log invii email | `email_send_log` (DB, dedup per `message_id`) |
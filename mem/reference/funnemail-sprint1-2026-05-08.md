---
name: Funnemail Sprint 1 — Auth hardening + Job ledger
description: Tabella email_processing_jobs + RPC record_email_processing_job_stage + auth hardening su funnemail-classify/scout-sender/auto-route via x-internal-token (=SERVICE_ROLE_KEY) + trigger materialization funnemail_decisions→funnemail_message_status e funnemail_actions_log→sub_status. DAL src/data/emailProcessingJobs.ts. Helper _shared/internalAuth.ts.
type: feature
---

## Cosa è stato implementato (2026-05-08)

1. **Migration**: `email_processing_jobs` (PK on message_id, stage enum, RLS owner-only SELECT, no INSERT/UPDATE per utenti).
2. **RPC** `record_email_processing_job_stage(message_id, user_id, stage, payload, error)` — security definer, grant solo a service_role, idempotente per message_id.
3. **Auth hardening** su `funnemail-classify`, `funnemail-scout-sender`, `funnemail-auto-route`: helper `_shared/internalAuth.ts::requireInternalOrUser` accetta JWT utente OPPURE header `x-internal-token` === `SUPABASE_SERVICE_ROLE_KEY` (server-to-server). Niente nuovo secret.
4. **Orchestratore**: `classify-inbound-message` passa l'header `x-internal-token` alle 3 invoke().
5. **Status materialization** (anticipata da Sprint 2):
   - Trigger `trg_funnemail_decisions_to_status` → upsert `funnemail_message_status` (status='classified', sub_status=suggested_action) ma solo se status corrente è in (pending, received, classified) per non sovrascrivere stati avanzati.
   - Trigger `trg_funnemail_actions_to_status` → su INSERT funnemail_actions_log con status=success aggiorna sub_status.
6. **DAL**: `src/data/emailProcessingJobs.ts` con `listEmailProcessingJobs`/`getEmailProcessingJob`.

## Da fare nei prossimi sprint
- UI tab "Job Ledger" in /v2/email-intelligence (Sprint 1 finale).
- Inserimento stage='received' nel trigger `on_inbound_message` quando inserisce in email_processing_jobs (idempotente ON CONFLICT).
- Chiamate a `record_email_processing_job_stage()` da ciascuna edge ai vari stage.
- Sprint 2: refactor classify-inbound-message in moduli sub-200 LOC.

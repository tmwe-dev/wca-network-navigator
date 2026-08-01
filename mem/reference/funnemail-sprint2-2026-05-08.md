---
name: Funnemail Sprint 2 - 2026-05-08
description: Decomposizione classify-inbound-message in stage modules sub-200 LOC + fix trigger materializzazione status
type: reference
---

# Sprint 2 Funnemail — completato 2026-05-08

## Decomposizione orchestrator
`classify-inbound-message` ridotto da 602 → 164 LOC, logica spostata in `stages/`:
- `stages/types.ts` (71): costanti, RequestBody, ClassifyResult, mapInboundToEmailCategory, makeRecordStage
- `stages/aiPromptBuilder.ts` (70): system+user prompt con Prompt Lab + normalize+sanitize
- `stages/stageClassifyAi.ts` (161): runAiClassification + persistClassificationSideEffects (insert reply_classifications, activity update, autopilot, needs_human)
- `stages/stagePostClassification.ts` (67): runEmailProcessManager + runFunnemailDispatcher
- `stages/stageFunnemailPipeline.ts` (83): scout → classify → auto-route (fire-and-forget, x-internal-token)
- `stages/stageContentAndContext.ts` (63): classify-inbound-content, refresh-conversation-context, runInboundTriage+alert

Tutti i file sub-200 LOC. Comportamento identico al monolite (estrazioni 1:1).

## Fix trigger materializzazione (Sprint 1 follow-up)
I trigger creati dalla migrazione Sprint 1 usavano colonne inesistenti
(`status_changed_by`/`status_changed_at`). Fixati in 2 migrazioni:
- `funnemail_message_status` ha `changed_by` UUID (NOT NULL), `changed_at` TIMESTAMPTZ
- `changed_by` ora valorizzato con `NEW.user_id`
- Trigger `funnemail_decisions_to_status` no-op se `NEW.user_id IS NULL` (le 8 decisioni preesistenti hanno user_id NULL e quindi non sono backfillabili)
- Trigger `funnemail_actions_to_status` rimuove la scrittura su `changed_by` (UUID system non disponibile)

## Verifica dati reali
- 8 decisioni preesistenti, tutte con `user_id NULL` → no backfill possibile
- Triggers attivi su `funnemail_decisions` e `funnemail_actions_log` (verificato `pg_trigger`)
- email_processing_jobs già esistente con RPC `record_email_processing_job_stage`

## Files modified
- supabase/functions/classify-inbound-message/index.ts (rewrite as orchestrator)
- supabase/functions/classify-inbound-message/stages/* (6 nuovi file)
- 2 migrazioni di fix trigger
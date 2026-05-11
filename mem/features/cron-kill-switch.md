---
name: Cron Kill-Switch Globale
description: system_flags.cron_paused + _shared/cronGate.ts + StatusPill toggle "Trasmissioni AI"
type: feature
---
- Tabella `system_flags` (key/value/updated_at/updated_by), RLS read=authenticated, write=admin.
- Flag iniziale: `cron_paused` (bool, default false).
- Helper edge: `supabase/functions/_shared/cronGate.ts` → `cronPausedResponse(admin, fn)` ritorna 503 + log strutturato `cron_paused_skip` se flag attiva.
- DAL: `src/data/systemFlags.ts` (getCronPaused, setCronPaused, listSystemFlags).
- UI: toggle "Trasmissioni AI" in StatusPill (top bar), refetch ogni 30s, invalida e mostra toast.
- Adottato in: `prompt-test-runner` (cron mode only). DA RETROFITTARE su: smart-scheduler, cadence-engine, outreach_scheduler_tick, agent_task_drainer_tick, batch_enrichment_worker_tick, kb-promoter, memory-promoter, email-cron-sync, kb_embed_backfill_daily, memory_embed_backfill_daily, ai-backup, ai-learning-feedback.
- Le invocazioni manuali (JWT) NON sono bloccate dal gate: la pausa ferma solo le trasmissioni automatiche.

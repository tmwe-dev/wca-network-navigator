---
name: Command Jobs & Persistent Agenda
description: Tabelle command_jobs/command_job_steps, hook useCommandJobs e WorkQueue laterale per dare al Direttore una vera agenda di lavori persistenti
type: feature
---
Pattern ispirato a swiftpack-studio (gestione listini): job persistenti in DB invece di stato volatile in RAM.

**Tabelle**
- `command_jobs(user_id, operator_id, conversation_id, title, goal, origin_prompt, status, phase, snapshot, ai_summary, progress, tags, last_activity_at, deleted_at)` — ownership via operator (RLS) + soft-delete.
- `command_job_steps(job_id, step_number UNIQUE, tool_id, status, params, result, ai_reasoning, error_message, started_at, completed_at, duration_ms)`.

**Enum**
- `command_job_status`: open, in_progress, awaiting_approval, paused, done, error, cancelled.
- `command_job_phase`: discovery, planning, awaiting_approval, executing, review, done.
- `command_job_step_status`: pending, running, awaiting_approval, done, error, skipped.

**DAL**
- `src/v2/io/supabase/queries/command-jobs.ts` — fetchOpenCommandJobs, fetchCommandJob, fetchCommandJobSteps, fetchCommandJobsByConversation.
- `src/v2/io/supabase/mutations/command-jobs.ts` — createCommandJob, updateCommandJob (con bump_activity), deleteCommandJob (soft), appendCommandJobStep, updateCommandJobStep.

**Hook + UI**
- `useCommandJobs()` espone openJobs (realtime subscription), createJob, updateJob, removeJob, loadJob, loadJobSteps, markPhase.
- `CommandWorkQueue` renderizza i job aperti con badge stato + fase + età. Inserito in `ConversationSidebar`.
- `useCommandSubmit` ora accetta `persistMessage`, `onUserPrompt`, `getExtraHint`. CommandPage:
  - persiste user/assistant messages su `command_messages` (deduplicato via Set di id);
  - apre auto un job al primo prompt sostanziale (>=12 char) della conversazione;
  - inietta l'agenda lavori aperti come hint informativo (NON eseguibile) nel planner.

**Query keys**: `queryKeys.commandJobs.{open, all, byStatus, byConversation, detail, steps}`.

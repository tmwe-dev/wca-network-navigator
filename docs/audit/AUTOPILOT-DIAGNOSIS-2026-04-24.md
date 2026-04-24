# Diagnosi 1584 agent_tasks pending — 2026-04-24

Output P1.2. Solo lettura, zero modifiche al sistema.

## TL;DR
**Root cause**: `agent-autopilot-worker` consuma `agent_missions`, **non** `agent_tasks`. Le missioni attive sono **0** → il worker esce subito, returning `{processed: 0}`. Le 1584 task accumulate sono create da `agent-autonomous-cycle` (cron `*/2 min`) ma **nessuna edge function le esegue**: non esiste un consumer per `agent_tasks WHERE status='pending'`.

## Risposte alle 8 domande del brief

### 1. L'autopilot worker è schedulato?
**Sì, attivo e funzionante.** `cron_job_status()`:

| jobname | schedule | active | last_run | last_status |
|---|---|---|---|---|
| `agent_autopilot_worker_tick` | `*/10 * * * *` | ✅ | 2026-04-24 07:00:00 | succeeded |
| `agent_autonomous_cycle_tick` | `*/2 * * * *` | ✅ | 2026-04-24 07:04:00 | succeeded |
| `outreach_scheduler_tick` | `* * * * *` | ✅ | 2026-04-24 07:04:00 | succeeded |
| `cadence-engine` | `0 * * * *` | ✅ | 2026-04-24 07:00:00 | **failed** |
| `email-sync-worker` | `*/3 * * * *` | ✅ | 2026-04-24 07:03:00 | **failed** |
| `email_cron_sync_tick` | `*/5 * * * *` | ✅ | 2026-04-24 07:00:00 | succeeded |
| `smart-scheduler` | `0 5 * * *` | ✅ | 2026-04-24 05:00:00 | **failed** |
| `kb-promoter` | `30 3 * * *` | ✅ | 2026-04-24 03:30:00 | **failed** |
| `memory-promoter` | `0 3 * * *` | ✅ | 2026-04-24 03:00:00 | **failed** |
| `ai-backup` | `0 4 * * 0` | ✅ | 2026-04-19 04:00:00 | **failed** |
| `ai-learning-feedback` | `0 5 * * 0` | ✅ | 2026-04-19 05:00:00 | **failed** |
| `cleanup-cron-runs` | `45 2 * * *` | ✅ | 2026-04-24 02:45:00 | succeeded |
| `cleanup-rejected-actions` | `30 2 * * *` | ✅ | 2026-04-24 02:30:00 | succeeded |
| `kb_embed_backfill_daily` | `0 3 * * *` | ✅ | 2026-04-24 03:00:00 | succeeded |
| `memory_embed_backfill_daily` | `15 3 * * *` | ✅ | 2026-04-24 03:15:00 | succeeded |

**7 jobs su 15 falliscono ricorrentemente** — `cadence-engine`, `email-sync-worker`, `smart-scheduler`, `kb-promoter`, `memory-promoter`, `ai-backup`, `ai-learning-feedback`. Da indagare separatamente.

### 2. Il worker controlla `ai_automations_paused`?
**No.** Il file `supabase/functions/agent-autopilot-worker/index.ts` (243 righe) **non legge mai** `ai_automations_paused` né da `app_settings`. Non esiste un gate globale di pausa nel worker. Non è il blocco.

Per riferimento: solo `ae35ad39-de57-45df-9d24-538cdbbd5e87` ha `ai_automations_paused=false` salvato. Tutti gli altri user non hanno la chiave (default implicito = non in pausa).

### 3. Finestra oraria?
**No, il worker non controlla orari.** Le chiavi `agent_work_start_hour=7` e `agent_work_end_hour=23` esistono **solo per** `c8aadbed-1f47-4c74-90dd-dccf44b87a16` (utente di test) ma il worker autopilot non le interroga. Eventuali finestre orarie sono applicate downstream da `agent-execute`, non dal worker.

Comunque siamo **dentro** la finestra (07:06 UTC).

### 4. Approval required?
**Non rilevante.** Il worker non guarda `approval_required` su `agent_tasks` perché **non legge `agent_tasks`**. La logica di approval (`agent_require_approval=true` per l'utente `c8aadbed`) è downstream.

Le 1584 task pending **non hanno meccanismo di approval esplicito** in tabella (lo schema `agent_tasks` ha solo `id, agent_id, user_id, task_type, description, target_filters, status, result_summary, execution_log, scheduled_at, started_at, completed_at, created_at, operator_id` — niente `requires_approval`).

### 5. Quante task hanno agent_id attivo?
**1582 / 1584** → 99,87%. Solo 2 orfane.

Distribuzione per task_type:
| task_type | count |
|---|---|
| screening | 1533 |
| follow_up | 42 |
| analysis | 12 |

Distribuzione per agente (top):
| agent | pending |
|---|---|
| Marco | 1162 |
| Luca — Director | 366 |
| gianfranco | 28 |
| Sara | 21 |
| altri | <10 ciascuno |

→ Le task **sono assegnate correttamente** ad agenti attivi. Non è il blocco.

### 6. Lock / status che bloccano?
**No campi di lock**. Schema `agent_tasks` NON ha `locked_at`, `lock_owner`, `updated_at` — solo `started_at`/`completed_at`.

Distribuzione status: 1584 `pending`, 36 `proposed`, 1 `completed`. **Nessuna task è "in_progress"** → nessuna è bloccata da un consumer in stallo. Sono semplicemente non lette.

### 7. FOR UPDATE SKIP LOCKED / lock attivi?
**No, nessun lock.** Il worker autopilot non usa `FOR UPDATE SKIP LOCKED`: fa una semplice `SELECT * FROM agent_missions WHERE status='active' AND autopilot=true LIMIT 5` (riga 53-58 di `agent-autopilot-worker/index.ts`).

`acquire_outreach_batch` (RPC con `FOR UPDATE SKIP LOCKED`) opera su `outreach_schedules`, **non** su `agent_tasks`.

### 8. Ultimo log autopilot?
Ultimo `succeeded` registrato in `cron_job_status`: **2026-04-24 07:00:00** (10 min fa). Il worker gira regolarmente. Tabella `cron.job_run_details` non leggibile dal mio user (`permission denied`), ma `cron_job_status()` (SECURITY DEFINER) conferma success.

Ultima task `completed`: **2026-04-10 08:18:15** (~14 giorni fa). Ultima task creata: **2026-04-24 07:06:02** (4 min fa, l'autonomous-cycle continua a generare).

## Diagnosi finale

```
┌─────────────────────────────┐
│ agent-autonomous-cycle      │ ogni 2 min → genera task in agent_tasks (status=pending)
└─────────────────────────────┘
                │
                ▼
    ╔═══════════════════════╗
    ║  agent_tasks (1584)   ║  ← nessuno legge qui
    ╚═══════════════════════╝
                ▲
                │ MANCA consumer
                ▼
┌─────────────────────────────┐
│ agent-autopilot-worker      │ ogni 10 min → legge agent_missions
└─────────────────────────────┘
                │
                ▼
    ╔═══════════════════════╗
    ║ agent_missions (0!)   ║  ← tabella vuota → 0 lavoro
    ╚═══════════════════════╝
```

**Due problemi distinti che si manifestano insieme:**
1. **Autopilot non lavora**: 0 missioni `status='active' AND autopilot=true` → worker resta inattivo nonostante schedule corretto.
2. **Coda task abbandonata**: `agent-autonomous-cycle` continua a popolare `agent_tasks` ma nessuna edge function le consuma.

## Cosa fare (P2, non in questo step)

- **Drainer task** (P2.A): edge function che consuma `agent_tasks WHERE status='pending'`, mark `started_at`, esegue, mark `completed_at`. Schedule pg_cron `*/5 min`.
- **Bootstrap missioni** (P2.B): UI o seed per creare almeno 1 mission `autopilot=true status='active'` per dare lavoro al worker.
- **Audit job falliti** (P2.C): 7 cron job ricorrenti in `failed` (cadence-engine, email-sync-worker, smart-scheduler, kb-promoter, memory-promoter, ai-backup, ai-learning-feedback). Ognuno richiede log analysis dedicata.
- **Pausa generazione** (opzionale P2.D): se non si vuole drenarle, mettere in pausa `agent_autonomous_cycle_tick` finché non c'è un consumer, evitando crescita ulteriore di task orfane.

## Vincoli rispettati
- Solo lettura. Zero modifiche a DB, edge, codice.
- Nessuna cancellazione di task pending (rispetta `no-physical-delete`).

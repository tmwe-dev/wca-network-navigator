

# P2 — Esecuzione approvata con correzioni

3 step sequenziali con conferma dopo ognuno. Tutte le note utente integrate.

## P2.A — `agent-task-drainer` (NUOVA edge + cron)

**File**: `supabase/functions/agent-task-drainer/index.ts` (~180 righe).

### Logica per tick

```text
1. Stuck detection (PRIMA del lock batch):
   UPDATE agent_tasks
   SET status='failed',
       completed_at=now(),
       result_summary='timeout: stuck >10min'
   WHERE status='running'
     AND started_at < now() - interval '10 minutes'
   RETURNING id, user_id;
   → log count come "stuck_reset"

2. Carica utenti in pausa:
   SELECT user_id FROM app_settings
   WHERE key='ai_automations_paused' AND value::text IN ('true','"true"');
   → set pausedUsers

3. Lock batch (max 10):
   UPDATE agent_tasks SET status='running', started_at=now()
   WHERE id IN (
     SELECT id FROM agent_tasks
     WHERE status='pending'
       AND user_id <> ALL(pausedUsers)
     ORDER BY created_at ASC
     LIMIT 10
     FOR UPDATE SKIP LOCKED
   )
   RETURNING id, agent_id, user_id, task_type;

4. Esecuzione concorrente (max 3 in parallelo, timeout 15s per task):
   - Promise.all su chunk di 3
   - per ogni task: AbortController con setTimeout(15000)
   - fetch POST /agent-execute body={agent_id, task_id} headers={Authorization: Bearer SERVICE_KEY}
   - se timeout o !ok: UPDATE agent_tasks SET status='failed',
                       completed_at=now(),
                       result_summary='drainer: <reason>'
   - se ok: agent-execute ha già aggiornato status internamente
            (riga 122-125 di index.ts → 'running' + started_at;
            handleGeneralTask completa o fallisce)
   - SAFETY NET: dopo singola call, se status è ancora 'running' dopo
                 risposta agent-execute, NON toccare (lascia che agent-execute
                 finisca async se ha chiamato tool LLM); lo stuck-reset
                 al tick successivo lo recupera

5. Wall-clock cap: se Date.now() - start > 55_000 → break loop
6. Return {processed, completed, failed, stuck_reset, paused_users_skipped}
```

### Cron schedule (insert non-migration, contiene service key)

```sql
SELECT cron.schedule(
  'agent_task_drainer_tick',
  '*/5 * * * *',
  $$ SELECT net.http_post(
       url := 'https://zrbditqddhjkutzjycgi.supabase.co/functions/v1/agent-task-drainer',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIs...ANON_KEY...'
       ),
       body := '{}'::jsonb
     ) AS request_id; $$
);
```

Drainer accetta anon (verify_jwt=false di default su Lovable). Internamente usa SERVICE_ROLE_KEY da env.

### Verifica post-deploy

1. Curl manuale `POST /agent-task-drainer` → atteso JSON `{processed: 0..10, completed: N, failed: M, stuck_reset: 0}`.
2. `SELECT count(*) FROM agent_tasks WHERE status='running' AND started_at < now() - interval '15 min'` → atteso 0 dopo 2 tick.
3. `SELECT status, count(*) FROM agent_tasks GROUP BY status` → pending deve calare di ~10/tick.

## P2.B — Bootstrap mission test (con verifica nome agente)

### Step 1: discovery (read-only) prima di INSERT

```sql
SELECT id, name FROM agents
WHERE user_id='1d51961d-da81-4914-b229-511cdce43e55'
  AND is_active=true
ORDER BY name;
```

→ scelgo agente reale dalla lista (gianfranco/Robin/Bruce/Renato/Carlo/Leonardo già confermati esistenti dall'audit precedente).

### Step 2: INSERT con id agente verificato

```sql
INSERT INTO agent_missions (
  user_id, agent_id, title, goal_description, goal_type,
  kpi_target, kpi_current, budget, budget_consumed,
  approval_only_for, autopilot, status
) VALUES (
  '1d51961d-da81-4914-b229-511cdce43e55',
  '<AGENT_ID_VERIFICATO>',
  'Mission test autopilot — drain backlog',
  'Esegui screening dei prospect inbound e proponi follow_up coerenti.',
  'lead_engagement',
  '{"emails_sent": 5, "deadline": "2026-05-01T00:00:00Z"}'::jsonb,
  '{}'::jsonb,
  '{"max_actions": 20, "max_emails_sent": 10, "max_tokens": 50000}'::jsonb,
  '{}'::jsonb,
  ARRAY['email','whatsapp']::text[],
  true, 'active'
) RETURNING id;
```

### Verifica post

Attesa 12 min, poi:
```sql
SELECT event_type, payload, created_at FROM agent_mission_events
WHERE mission_id='<NEW_MISSION_ID>' ORDER BY created_at DESC;
```
Atteso almeno 1 `autopilot_tick` o `tick_completed`.

## P2.C — Diagnosi 7 cron failed (read-only documento)

Crea `docs/audit/CRON-FAILED-DIAGNOSIS-2026-04-24.md`.

### Test diagnostici

1. **GUC check**:
   ```sql
   SELECT current_setting('app.settings.service_role_key', true) AS srk_value,
          length(coalesce(current_setting('app.settings.service_role_key', true),'')) AS srk_len;
   ```
2. **Curl diretto** delle 7 functions con service-role reale via `supabase--curl_edge_functions` per isolare:
   - 401 → conferma ipotesi GUC
   - 500/altro → bug interno function
3. **Lettura code** delle 7 functions per cercare env-vars mancanti, deps rotte, auth check interno.

### Output documento

| Function | HTTP code | Root cause | Fix proposto |
|---|---|---|---|
| cadence-engine | TBD | TBD | TBD |
| email-sync-worker | TBD | TBD | TBD |
| smart-scheduler | TBD | TBD | TBD |
| kb-promoter | TBD | TBD | TBD |
| memory-promoter | TBD | TBD | TBD |
| ai-backup | TBD | TBD | TBD |
| ai-learning-feedback | TBD | TBD | TBD |

**Recommendation finale**: se confermato GUC vuoto, fix per-job:
```sql
SELECT cron.unschedule('cadence-engine');
SELECT cron.schedule('cadence-engine', '0 * * * *',
  $$ SELECT net.http_post(
       url := 'https://zrbditqddhjkutzjycgi.supabase.co/functions/v1/cadence-engine',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ANON_KEY_REALE'
       ),
       body := '{}'::jsonb) $$);
```
× 7. **Da eseguire in P2.D futuro su conferma esplicita** (non in P2.C).

## Vincoli rispettati

- `no-physical-delete`: drainer fa solo UPDATE status, mai DELETE.
- `agent-execute` invariato.
- Worker autopilot esistente invariato.
- Cron via insert (contiene chiavi specifiche utente, non in migration).
- Architettura V2 invariata, nessuna modifica a `src/v2`.
- DAL pattern: drainer è edge service-side, esente.
- `secret-management-standard`: service-role key da env, non hardcoded nell'edge.

## File toccati

- **Nuovo**: `supabase/functions/agent-task-drainer/index.ts`
- **DB**: 1 cron schedule + 1 mission INSERT + (P2.C: solo SELECT)
- **Nuovo doc**: `docs/audit/CRON-FAILED-DIAGNOSIS-2026-04-24.md`
- **Aggiornato**: `docs/audit/AUTOPILOT-DIAGNOSIS-2026-04-24.md` (riferimento drainer)

## Ordine

P2.A (deploy + verifica) → conferma → P2.B (verifica nome + insert) → conferma → P2.C (documento). Ogni step si ferma per conferma utente.


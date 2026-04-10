

# Piano: Fix 5 Bug Critici + Fondazione Test Suite

## Fase 1 — Fix dei 5 bug (priorità P0)

### Bug 1: `sent_count` incrementato anche su failure
**File**: `supabase/functions/process-email-queue/index.ts` (righe 244-249)
**Problema**: Il blocco che incrementa `sent_count` è FUORI dal try/catch, quindi viene eseguito sia dopo un invio riuscito sia dopo un fallimento.
**Fix**: Spostare l'incremento di `sent_count` dentro il blocco try, subito dopo `sentCount++` (riga 233), così viene eseguito solo su successo.

### Bug 2: `tasks_completed` incrementato anche su failure
**File**: `supabase/functions/agent-execute/index.ts` (righe 345-349)
**Problema**: `tasks_completed` viene incrementato incondizionatamente, anche quando `taskStatus === "failed"`.
**Fix**: Wrappare l'incremento in `if (taskStatus === "completed")`. Aggiungere un contatore separato `tasks_failed` per i fallimenti.

### Bug 3: Orari incoerenti tra frontend/cron/agenti
**Problema**: 3 logiche diverse — frontend usa ora locale browser, `agent-autonomous-cycle` usa `new Date().getHours()` (UTC del runtime Deno), `email-cron-sync` ha la sua finestra.
**Fix**: 
- Leggere `agent_work_start_hour` e `agent_work_end_hour` da `app_settings` in `agent-autonomous-cycle`
- Usare un timezone esplicito (CET/CEST) con calcolo offset invece di `getHours()` locale
- Il frontend già usa ora locale del browser, che è corretto per l'utente

### Bug 4: Costanti hardcoded in `agent-autonomous-cycle`
**File**: `supabase/functions/agent-autonomous-cycle/index.ts`
**Problema**: `BUDGET_PER_AGENT=10`, `CYCLE_LOOKBACK_MINUTES=12`, orari notte hardcoded. Ma esistono settings configurabili in `app_settings`.
**Fix**: All'inizio del ciclo, caricare da `app_settings`:
- `agent_max_actions_per_cycle` → usare al posto di `BUDGET_PER_AGENT`
- `agent_work_start_hour` / `agent_work_end_hour` → usare al posto di `isNightTime()`
- `agent_require_approval` → già usato parzialmente, verificare copertura completa
- Mantenere le costanti come fallback default se i settings non esistono

### Bug 5: Side effects disallineati send-email vs queue
**File**: `supabase/functions/send-email/index.ts`
**Problema**: L'invio diretto logga solo `interactions`. La queue logga anche `activities`, aggiorna `partners.last_interaction_at`, `interaction_count`, `lead_status`.
**Fix**: Estrarre la logica di side effects in una funzione shared `_shared/logEmailSideEffects.ts` e usarla in entrambi i percorsi. Parametri: `partner_id`, `user_id`, `subject`, `to`, `html`. Effetti: insert `interactions` + insert `activities` + update `partners`.

---

## Fase 2 — Test Suite fondamentali

### Suite A: State Consistency (Vitest)
**File**: `src/test/state.email-draft-consistency.test.ts`
- Verifica che `email_drafts.sent_count` == count di `email_campaign_queue` con `status='sent'`
- Verifica che nessun item `failed` abbia contribuito a `sent_count`

**File**: `src/test/state.agent-task-consistency.test.ts`
- Verifica che `agents.stats.tasks_completed` == count di `agent_tasks` con `status='completed'`
- Verifica che task `failed` non incrementi `tasks_completed`

### Suite B: Edge Function Contracts (Deno)
**File**: `supabase/functions/process-email-queue/index_test.ts`
- CORS preflight
- 401 senza auth
- Shape risposta coerente

**File**: `supabase/functions/agent-execute/index_test.ts`
- CORS preflight
- 401 senza auth
- Shape risposta con task_id

### Suite C: Email Sending (Deno)
**File**: `supabase/functions/send-email/index_test.ts`
- Verifica che side effects (interactions + activities + partners) vengano creati

---

## Dettagli tecnici

```text
Fase 1 — File modificati:
├── supabase/functions/process-email-queue/index.ts    (sposta sent_count dentro try)
├── supabase/functions/agent-execute/index.ts          (condiziona tasks_completed)
├── supabase/functions/agent-autonomous-cycle/index.ts (legge app_settings, timezone CET)
├── supabase/functions/send-email/index.ts             (aggiunge side effects completi)
└── supabase/functions/_shared/logEmailSideEffects.ts  (NUOVO — logica condivisa)

Fase 2 — File creati:
├── src/test/state.email-draft-consistency.test.ts
├── src/test/state.agent-task-consistency.test.ts
├── supabase/functions/process-email-queue/index_test.ts
├── supabase/functions/agent-execute/index_test.ts
└── supabase/functions/send-email/index_test.ts
```

### Ordine di esecuzione
1. Fix Bug 1 + Bug 2 (contatori — fix più semplici e critici)
2. Fix Bug 5 (side effects — crea shared module)
3. Fix Bug 4 (settings da DB)
4. Fix Bug 3 (timezone CET)
5. Test suite state consistency
6. Test suite edge function contracts
7. Deploy e verifica


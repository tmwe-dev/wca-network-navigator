

# Piano Esecutivo: Testing Completo + Fix Bug Critici

## Bug Confermati (ancora presenti nel codice)

### BUG 1 — `sent_count` incrementato anche su failure (ANCORA VIVO)
**File**: `process-email-queue/index.ts` righe 243-250
**Problema**: L'incremento di `sent_count` è FUORI dal try/catch. Il guard `if (sentCount > 0)` resta true dopo il primo successo, quindi incrementa `sent_count` anche sulle iterazioni failed successive.
**Fix**: Spostare l'intero blocco (righe 243-250) DENTRO il try, subito dopo `sentCount++` (riga 233).

### BUG 5 — Side effects disallineati (FIX INCOMPLETO)
**File**: `process-email-queue/index.ts` righe 173-231
**Problema**: `send-email` usa `logEmailSideEffects` (shared module), ma `process-email-queue` ha ancora il suo codice inline con logica diversa (include `source_meta`, gestisce `interaction_count` separatamente, scrive direttamente `interactions` con formato diverso).
**Fix**: Sostituire il blocco inline 173-231 con una chiamata a `logEmailSideEffects`, passando `source_meta` come parametro aggiuntivo.

### BUG 3 — Orari incoerenti (ANCORA VIVO in email-cron-sync)
**File**: `email-cron-sync/index.ts` righe 29-36
**Problema**: Usa `getUTCHours()` con range hardcoded 23-05 UTC, mentre `agent-autonomous-cycle` usa `getCETHour()` via `Intl.DateTimeFormat("Europe/Rome")`.
**Fix**: Estrarre `getCETHour()` in `_shared/timeUtils.ts` e usarlo in entrambi i file. Leggere `agent_work_start_hour`/`agent_work_end_hour` da `app_settings`.

### BUG 2 e BUG 4 — GIA' FIXATI
`agent-execute` condiziona correttamente `tasks_completed` (riga 348). `agent-autonomous-cycle` legge da `app_settings` (righe 166-181).

---

## Fase 1 — Fix 3 bug residui

### 1.1 Fix `sent_count` in `process-email-queue/index.ts`
Spostare righe 243-250 dentro il blocco try, dopo riga 233.

### 1.2 Creare `_shared/timeUtils.ts`
Estrarre `getCETHour()` e `isOutsideWorkHours()` in modulo condiviso. Usarlo in `email-cron-sync` e `agent-autonomous-cycle`.

### 1.3 Allineare `email-cron-sync` a settings
Leggere `agent_work_start_hour`/`agent_work_end_hour` da `app_settings` invece di usare range hardcoded.

### 1.4 Sostituire side effects inline in `process-email-queue`
Rimpiazzare righe 173-231 con chiamata a `logEmailSideEffects`, aggiungendo supporto `source_meta` al modulo shared.

---

## Fase 2 — Test Suite (24 file)

### Vitest (8 file)

**`src/test/contracts.edge-auth.test.ts`** — [A02]
Chiama ogni edge function critica senza auth → verifica 401. Con auth invalido → 401.

**`src/test/contracts.edge-response-shapes.test.ts`** — [A03]
Chiama edge functions con input valido → verifica shape JSON (chiavi obbligatorie, tipi).

**`src/test/state-enum-integrity.test.ts`** — [A04]
Query DB: verifica che `email_drafts.queue_status`, `agent_tasks.status`, `partners.lead_status` contengano solo valori ammessi.

**`src/test/state-counter-consistency.test.ts`** — [A05]
Query DB: `email_drafts.sent_count` == count `email_campaign_queue(status='sent')` per ogni draft. `agents.stats.tasks_completed` == count `agent_tasks(status='completed')` per ogni agent.

**`src/test/app-settings-minimum-viability.test.ts`**
Query DB: verifica che chiavi SMTP e agent settings esistano in `app_settings`.

**`src/test/email-sync-resume.test.ts`** — [B06]
Logica pura: verifica che il sync riprende da `last_uid` salvato, non da zero.

**`src/test/time-window-consistency.test.ts`** — [B10]
Logica pura: verifica che `getCETHour()`, `isOutsideWorkHours()` e il range `email-cron-sync` producano risultati coerenti per lo stesso timestamp.

**`src/test/send-email-html-composition.test.ts`** — [C03]
Logica pura: verifica sanitizzazione HTML, composizione firma agente, iniezione footer.

### Deno Integration Tests (8 file)

Ogni test usa `fetch` verso l'edge function deployata, verifica response + side effects via query DB.

**`supabase/functions/check-inbox/index.integration.test.ts`** — [B01-B05, B07-B08]
Scenari: inbox vuota, email nuova, duplicata, errori consecutivi.

**`supabase/functions/email-sync-worker/index.integration.test.ts`** — [B06]
Scenario: resume da ultimo UID.

**`supabase/functions/email-cron-sync/index.integration.test.ts`** — [B09-B10]
Scenari: night pause, coerenza finestra oraria con settings.

**`supabase/functions/generate-email/index.integration.test.ts`** — [C01-C02]
Scenari: contatto valido → draft generato, contatto mancante → errore.

**`supabase/functions/send-email/index.integration.test.ts`** — [C04-C05, C13]
Scenari: invio riuscito con side effects (interactions + activities + partners), SMTP fail.

**`supabase/functions/process-email-queue/index.integration.test.ts`** — [C06-C12, C14]
Scenari: pause/resume/cancel, batch misto sent/failed, contatori coerenti, side effects.

**`supabase/functions/agent-autonomous-cycle/index.integration.test.ts`** — [D01-D10]
Scenari: screening, deduplicazione task, routing agente, high-stakes, budget, settings, night pause.

**`supabase/functions/agent-execute/index.integration.test.ts`** — [D11-D16]
Scenari: task success/fail, stats corretti, approval rispettata, niente zombie.

### Playwright E2E (8 file)

**`e2e/app-routing-access.spec.ts`** — [A01]
Route protette redirect a /auth, route pubbliche accessibili.

**`e2e/direct-send-vs-queued-send-consistency.spec.ts`** — [C14]
Confronta side effects business tra i due percorsi.

**`e2e/email-inbound-to-task.spec.ts`** — [E01]
Flow completo: messaggio inbound → task visibile in UI.

**`e2e/followup-mission.spec.ts`** — [E02]
Lead inattivo → follow-up generato → visibile in dashboard.

**`e2e/campaign-queue-lifecycle.spec.ts`** — [E03]
Lifecycle: enqueue → processing → pause → resume → complete.

**`e2e/agent-approval-flow.spec.ts`** — [E04]
High-stakes → proposed → approve/reject in UI.

**`e2e/deep-search-runner.spec.ts`** — [E05]
Deep search skip partner già arricchiti.

**`e2e/queue-ui-state-consistency.spec.ts`** — [E06]
UI status coerente con `email_drafts.queue_status` nel DB.

---

## Ordine di esecuzione

1. Fix Bug 1 (`sent_count`) + Bug 5 (side effects queue) + `_shared/timeUtils.ts`
2. Fix Bug 3 (`email-cron-sync` allineato a settings/CET)
3. Deploy edge functions aggiornate
4. Scrivere e eseguire Vitest suite (8 file)
5. Scrivere e eseguire Deno integration tests (8 file)
6. Scrivere Playwright E2E (8 file)
7. Eseguire tutti i test, documentare bug trovati, applicare fix minimi
8. Produrre scorecard finale di affidabilità

---

## Note tecniche

- I Deno tests usano `dotenv/load.ts` per `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`
- I test che verificano side effects DB usano `supabase-js` con service role per query di verifica
- I Vitest che verificano stato DB usano il client Supabase esistente del progetto
- Nessun mock dove serve verifica reale su DB
- I fix preservano architettura e naming esistenti


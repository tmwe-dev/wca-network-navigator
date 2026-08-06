# BATCH 6 — Mappa e semplificazione agenti/automazioni (2026-07-31)

Read-only sull'infrastruttura; nessuna nuova feature, nessun cambio comportamentale.

## 1. Entry point delle automazioni

| Livello                                       | Conteggio                         | Note                                                        |
| --------------------------------------------- | --------------------------------- | ----------------------------------------------------------- |
| Cron job attivi (pg_cron)                     | 24                                | 19 invocano Edge Functions, 5 sono SQL di retention/cleanup |
| Edge Functions "orchestratore/worker"         | 14                                | vedi tabella sotto                                          |
| Helper cron condivisi                         | 2 (`cronGate.ts`, `cronGuard.ts`) | ownership ora separata, senza sovrapposizione               |
| Funzioni con validazione `CRON_SECRET` inline | 6                                 | contratto eterogeneo, NON migrate (vedi §4)                 |

## 2. Orchestratori — LOC e ownership

| Function               |  LOC | Trigger             | Ownership                  |
| ---------------------- | ---: | ------------------- | -------------------------- |
| agent-execute          | 5576 | on-demand (UI/tool) | esecuzione tool agente     |
| agent-autonomous-cycle |  549 | cron \*/10          | ciclo autonomo agenti      |
| outreach-scheduler     |  435 | cron \*/5           | accodamento outreach       |
| memory-promoter        |  413 | cron 0 3            | promozione memoria L2→L3   |
| kb-supervisor          |  336 | on-demand           | governance KB              |
| email-cron-sync        |  298 | cron \*/10          | sync mailbox               |
| agent-loop             |  296 | on-demand           | loop ReAct                 |
| agent-task-drainer     |  267 | cron \*/2           | drain coda task            |
| agent-autopilot-worker |  266 | cron \*/30          | autopilot missioni         |
| agent-audit            |  231 | on-demand           | audit agenti               |
| agentic-decide         |  222 | on-demand           | decisione agentica         |
| mission-executor       |  186 | on-demand           | esecuzione missione        |
| smart-scheduler        |  166 | cron 0 5            | pianificazione giornaliera |
| kb-promoter            |  113 | cron 30 3           | promozione KB              |

`agent-execute` (5576 LOC) resta il monolite dominante: candidato prioritario di un
batch dedicato, non toccato qui per non alterare comportamento.

## 3. Duplicazione provata e consolidata

**Kill-switch `system_flags.cron_paused` implementato due volte**

- `_shared/cronGate.ts` → `isCronPaused()` (usato da 8 funzioni)
- `_shared/cronGuard.ts` → stesso identico blocco inline (usato dai 4 worker)

Consolidamento: `cronGuard` ora importa `isCronPaused` da `cronGate` (unica
implementazione). In più, le due letture identiche di `app_settings` globali sono
state fattorizzate in `readGlobalSetting()` locale.

| Metrica                                                                     |     Prima |                       Dopo |
| --------------------------------------------------------------------------- | --------: | -------------------------: |
| Implementazioni di `cron_paused`                                            |         2 |                          1 |
| LOC `cronGuard.ts`                                                          |       120 |                        111 |
| Blocchi try/catch duplicati in `cronGuard`                                  |         4 |                          2 |
| Contratto pubblico (`cronGuardCheck`, `cronGuardLogRun`, `CronGuardResult`) | invariato |                  invariato |
| Caller da modificare                                                        |         — | 0 (nessun adapter rimosso) |

Comportamento preservato: stesso ordine dei gate (paused → toggle → throttle),
stesso log `cron_paused_skip`, stesso fail-open su errore di lettura.

Test contratto/fallback: `supabase/functions/_shared/cronGuard.test.ts` (6 test
offline, client simulato) — priorità gate, disabled_by_user, throttled, skip
false, fail-open, logging run.

## 4. Duplicazioni rilevate e NON consolidate (motivate)

- **6 funzioni con `CRON_SECRET` inline** (`dispatch-integrity-check`,
  `prompt-test-runner`, `replay-domain-events`, `smart-scheduler`,
  `tmwe-customer-sync`, `agent-prompt-refiner`): shape di errore e header
  differenti; migrarle cambierebbe il contratto verso pg_cron → batch dedicato.
- **Prompt sparsi**: 10 file in `src/v2/agent/prompts/core/`, 5 in
  `src/constants/agentPrompts*`, 190 LOC in `_shared/edgeFnPromptRegistry.ts`.
  Le tre fonti servono runtime diversi (UI v2, legacy v1, edge) e non contengono
  testi identici: nessuna duplicazione provata, quindi nessun merge.
- **`agent-loop` vs `agent-autonomous-cycle`**: trigger e stato differenti
  (on-demand vs ciclo cron), nessun code path identico.

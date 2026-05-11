## Obiettivo

Un solo entry point per ciascuno dei 6 blocchi operativi bulk (enrichment, deep search, download, inbound enrichment, verifiche bulk, update bulk). UI ridotte a "pulsanti che chiamano". Guardrail automatici che bloccano l'uso di funzioni alternative.

## Architettura target

Nuovo modulo `src/v2/services/bulkOps/` come SSOT:

```text
src/v2/services/bulkOps/
├── registry.ts          # Mappa scope → entry point unico
├── types.ts             # BulkJob, BulkResult, BulkScope
├── runner.ts            # runBulkOp(scope, items, opts) — stato/retry/log centralizzati
├── jobStore.ts          # Persistenza su bulk_jobs (DB) + realtime
├── entries/
│   ├── enrichBase.ts    # → enrich-partner-website / batch-enrichment-worker
│   ├── deepSearch.ts    # → useSherlock (Scout/Detective/Sherlock)
│   ├── download.ts      # → process-download-job + bridge
│   ├── inboundEnrich.ts # → process-inbound-enrichment
│   ├── verify.ts        # → WA/LI/Email/Dedup verifications
│   └── update.ts        # → bulk update DAL (origin, lead_status, email rules)
└── guardrails.ts        # Hook che blocca chiamate dirette in dev
```

## Mapping entry point unico (per blocco)

| Blocco | Entry point UNICO | Da dismettere / rendere interno |
|---|---|---|
| 1. Arricchimento base | `bulkOps.run("enrich.base", ...)` → wrap di `useBaseEnrichment` | chiamate dirette a `enrich-partner-website` da UI; pulsanti propri in OraclePanel/NetworkPage/Cockpit |
| 2. Deep Search | `bulkOps.run("deepsearch.sherlock", ...)` → `useSherlock` (3 livelli) | `useDeepSearchV2` e `useDeepSearchRunner` resi **interni** a `bulkOps.entries`; `useDeepSearchLocal` mantenuto solo come back-end batch enrichment (già da memoria), non più chiamabile da UI |
| 3. Download | `bulkOps.run("download.partner", ...)` → `process-download-job` + bridge | invocazioni dirette a `scrape-website` / bridge da componenti |
| 4. Inbound enrichment | `bulkOps.run("enrich.inbound", ...)` → `process-inbound-enrichment` | chiamate ad-hoc da Funnemail UI |
| 5. Verifiche bulk | `bulkOps.run("verify.{wa\|li\|email\|dedup}", ...)` | `useBulkLinkedInDispatch`, `useLinkedInLookup`, `useLinkedInFlow` resi interni; UI usa solo `bulkOps` |
| 6. Update bulk | `bulkOps.run("update.{origin\|leadStatus\|emailRules\|backfill\|analyzeAi\|dispatch}", ...)` | DAL functions (`bulkUpdateContactsOrigin`, `applyLeadStatusChange`, `bulkUpdateAutoAction`, `bulkSetBlocked`, `backfillForAddress/Group`, `suggest-email-groups`) restano ma **uso diretto vietato dalla UI**: passare via `bulkOps` |

> Le funzioni "interne" non vengono cancellate: vengono spostate sotto `bulkOps/entries/` o marcate `@internal` con barrel export che non le ri-esporta. Nessun refactor opportunistico al loro interno.

## Runner centralizzato

`runBulkOp(scope, items, opts)` fa:

1. **Validate**: `scope` deve esistere nel `registry`.
2. **Persist**: crea record in nuova tabella `bulk_jobs` (status, scope, total, processed, errors, created_by, source_view).
3. **Execute**: delega all'entry interna; `Promise.allSettled` con concurrency cap; `withRetry` (già in `src/v2/bridge/retry.ts`) per errori transienti.
4. **Log**: `structuredLogger` + eventi su `bulk_job_events` (append-only).
5. **Realtime**: hook `useBulkJob(jobId)` per progress UI (riusa pattern di `useDownloadJobs`).

## Guardrail

**A. Routing registry** (`registry.ts`): unica fonte di verità `scope → handler`. Nessun handler raggiungibile fuori dal registry.

**B. ESLint rule** `no-direct-bulk-op`: vieta import di:
- `enrich-partner-website`, `batch-enrichment-worker`, `process-download-job`, `process-inbound-enrichment`, `suggest-email-groups`, `backfill-email-rules` da file `src/**/ui/**` e `src/components/**`
- hook `useDeepSearchV2`, `useDeepSearchRunner`, `useDeepSearchLocal`, `useBulkLinkedInDispatch` fuori da `src/v2/services/bulkOps/`
- DAL bulk functions fuori da `src/v2/services/bulkOps/` e `src/data/`

Modello: replicare pattern di `eslint-rules/no-direct-ai-invoke.js`.

**C. Runtime guard (DEV only)**: `assertCalledFromBulkOps()` invocato dentro le entry interne; lancia errore in `import.meta.env.DEV` se lo stack non contiene `bulkOps/runner`.

**D. CI script**: `scripts/audit-bulk-ops.ts` (modello `audit-ai-invocations.ts`) → fail se trova caller proibiti.

## Migrazione UI (chirurgica, no logica nuova)

Aggiornare i call-site mappati nella ricognizione precedente, sostituendo l'invocazione attuale con `bulkOps.run(scope, items)`:

- `OraclePanel`, `NetworkPage`, `CockpitPage`, `Settings/Enrichment` → `enrich.base` / `deepsearch.sherlock`
- `LiveOperationCards`, `JobMonitor`, `AcquisizionePartnerPage` → `download.partner`
- `Funnemail`, `EmailIntelligence` → `enrich.inbound`, `update.emailRules`, `update.analyzeAi`, `update.backfill`
- `ContactsPage`, `Missions`, `HoldingPattern` → `verify.*`, `update.origin`, `update.leadStatus`, `verify.wa`, `verify.li`
- `EmailComposer/Canvas`, `SherlockLauncherDialog`, `HeaderToolsMenu` → `deepsearch.sherlock`
- `ImportWizard` → `verify.dedup`

Nessun cambiamento di stile/markup. Solo handler dei pulsanti.

## DB

Nuova migrazione:
- `bulk_jobs` (id, scope, source_view, total, processed, success_count, error_count, status, created_by, created_at, completed_at, payload jsonb)
- `bulk_job_events` (id, job_id, event_type, payload jsonb, created_at) — append-only
- RLS: owner-only + admin via `has_role`
- Realtime publication su entrambe

## Test di regressione

`src/test/bulkOps/`:
1. `registry.test.ts` — ogni scope ha esattamente un handler.
2. `runner.test.ts` — persistenza job, retry, eventi.
3. `enrich-base.entry.test.ts` — chiama l'edge attesa, non altre.
4. `deepsearch.entry.test.ts` — risolve a `useSherlock`, non a V2/Runner/Local.
5. `download.entry.test.ts`
6. `inbound-enrich.entry.test.ts`
7. `verify.entry.test.ts` (4 sotto-scope)
8. `update.entry.test.ts` (6 sotto-scope)
9. `guardrail.lint.test.ts` — esegue ESLint rule su fixture proibite/permesse.
10. `guardrail.audit.test.ts` — esegue `scripts/audit-bulk-ops.ts` su snapshot src/.

E2E (Playwright) di smoke:
- `e2e/bulk-ops-routing.spec.ts` — clicca un pulsante per scope e verifica che nasca un record `bulk_jobs` con `scope` corretto.

## Cosa NON tocco (per principio madre)

- Logica interna di `enrich-partner-website`, `process-download-job`, `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (memoria vincolante).
- Sherlock engine interno.
- `journalistReview` e gate editoriale.
- Soft-delete trigger.
- Tutti i prompt operativi e Funnemail pipeline (lavoro precedente preservato).

## Output atteso

- 1 modulo `bulkOps` + registry.
- 2 tabelle nuove (`bulk_jobs`, `bulk_job_events`) + RLS + realtime.
- 1 ESLint rule + 1 audit script wired in CI.
- ~25 call-site UI aggiornati a chiamare solo `bulkOps.run(...)`.
- ~10 file di test verdi.
- 1 memoria nuova: `mem://architecture/bulk-ops-single-entry-point`.

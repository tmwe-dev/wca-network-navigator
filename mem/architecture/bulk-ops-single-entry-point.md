---
name: BulkOps SSOT
description: Modulo bulkOps unico entry point per 6 blocchi (enrich, deepsearch, download, inbound, verify, update); UI vietato chiamare edge direttamente
type: constraint
---
# bulkOps — SSOT operazioni massive

`src/v2/services/bulkOps/` è UNICO entry point per job bulk:
- `runBulkOp(scope, items, opts)` o `startBulkOp` (fire-and-forget)
- Stato persistito in tabelle `bulk_jobs` / `bulk_job_events` (RLS owner+admin, realtime)
- Hook `useBulkJob(jobId)` per progress

## Scope (14 totali)
- `enrich.base` → enrich-partner-website
- `deepsearch.sherlock` → sherlock-extract
- `download.partner` → process-download-job
- `enrich.inbound` → process-inbound-enrichment
- `verify.{wa,li,email,dedup}`
- `update.{origin,leadStatus,emailRules,backfill,analyzeAi,dispatch}`

## Guardrail
- ESLint rule `lovable/no-direct-bulk-op` (eslint-rules/no-direct-bulk-op.cjs) blocca import di edge bulk (enrich-partner-website, sherlock-extract, process-download-job, ecc.) e hook legacy (useDeepSearchV2/Runner/Local, useBulkLinkedInDispatch, useBaseEnrichment) fuori da `src/v2/services/bulkOps/`, `src/data/`, `src/lib/api/`, `src/lib/ai/`. Livello attuale: warn.
- Runtime guard `assertCalledFromRunner` in DEV.
- Test in `src/test/bulkOps/` (registry+runner+guardrail).

## Migrazione UI residua
Le ~25 call-site mappate (OraclePanel, NetworkPage, CockpitPage, EmailIntelligence, Funnemail, ContactsPage, Missions, EmailComposer, ImportWizard, HeaderToolsMenu, LiveOperationCards, JobMonitor, Settings/Enrichment) devono passare a `runBulkOp(scope, items)`. ESLint warn segnala i caller residui.

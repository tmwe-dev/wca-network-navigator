---
name: KB Canonical Governance
description: Tassonomia 6 famiglie, Single Source of Truth Fatti Canonici TMWE, FunnyMail atomizzata in 6 step, audit settimanale via kb-doctrine-audit
type: feature
---
- 6 famiglie canoniche su `kb_entries.family`: doctrine | procedures | personas | playbooks | glossary | data-schema. Mapping legacy in `_shared/kbCategoryMapper.ts`.
- Single Source of Truth dei numeri: entry `Fatti Canonici TMWE` (canonical_id `doctrine/canonical-facts`). Le altre entry rinviano via `[[Vedi: Fatti Canonici TMWE]]`, mai duplicano numeri.
- Procedura FunnyMail atomizzata in 6 entry `procedures/funnymail/01..06` (deep-search, classification, summary, job-creation, assignment, next-step).
- Schema: colonne `kb_entries.canonical_id` UNIQUE, `family` (CHECK 6 valori), `last_reviewed_at`. Vista `v_kb_active_canonical` solo entry attive non soft-deleted.
- Audit: edge `kb-doctrine-audit` salva snapshot in `kb_audit_reports` (duplicati esatti+semantici≥0.92, numeri liberi, tag/family mancanti). Cron `kb-doctrine-audit-weekly` lunedì 06:00 UTC.
- Tutte le riassegnazioni passano da `kb_entry_proposals` (operation in {create,edit}) con approvazione 1-click in KB Supervisor. Mai scritture dirette su `kb_entries`.
- Duplicati: si rimuovono via soft-delete trigger esistente (mai DELETE fisica).
- DAL: `src/data/kbGovernance.ts` (fetchLatestAuditReport, fetchFamilyDistribution, fetchPendingProposalsSummary).
- 7 proposte canoniche già seeded (1 update Fatti Canonici + 6 create FunnyMail step), pendenti di approvazione.
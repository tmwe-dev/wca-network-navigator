---
name: P5 CRM Lifecycle
description: Soft-link transfer imported_contacts→partners, dedup detection all'import, cron expire stuck import_logs
type: feature
---

## P5 — 2026-04-28

### P5.1 — Dedup all'import
- RPC `find_import_duplicates(user_id, emails[], company_names[])` (SECURITY DEFINER, STABLE).
- Match: email in `imported_contacts` (stesso utente) + email in `partners` (globale) + company_name in `partners` (case-insensitive).
- Integrato in `useImportWizard.handleConfirmMapping`: warn non-bloccante via toast prima del create.

### P5.2 — Soft-link post-transfer
- Nuove colonne `imported_contacts.transferred_to_partner_id` (FK→partners ON DELETE SET NULL) + `transferred_at`.
- Backfill: contatti già `is_transferred=true` → `transferred_at = created_at`.
- DAL `linkContactToPartner(id, partnerId)` sostituisce `markContactTransferred` in `useTransferToPartners` e `useCreateActivitiesFromImport`.
- NO delete fisica (`mem://constraints/no-physical-delete`).

### P5.3 — Cron expire stuck imports
- Funzione `expire_stuck_import_logs()` → marca `pending|processing` > 30min come `expired`.
- Cron `expire-stuck-import-logs` ogni 15 min (jobid=49) via `cron.schedule`.

### Test
- 13/13 verdi (`useImportWizard.test.ts`).

### Constraint
- Soft-delete preservato: trigger DB intercetta DELETE su `imported_contacts`/`partners`.
- `markContactTransferred` mantenuta per backward-compat (non rimossa).

/**
 * generate-email/playbookLoader.ts — Thin re-export shim.
 *
 * La logica reale vive in `_shared/playbookLoader.ts` (SSOT). Audit Sez.3:
 * eliminato duplicato (~58 LOC) che divergeva di 5 caratteri dalla versione
 * di generate-outreach. Path di import preservato per backward-compat.
 */
export { loadActivePlaybook, type ActivePlaybookResult } from "../_shared/playbookLoader.ts";

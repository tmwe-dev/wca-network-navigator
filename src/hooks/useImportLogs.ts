/**
 * useImportLogs — Barrel re-export for backward compatibility.
 * The original 619-LOC monolith has been decomposed into:
 *   - useImportLogQueries.ts  (read hooks + types)
 *   - useImportLogActions.ts  (mutation hooks)
 *   - useImportLogUtils.ts    (pure utilities)
 */
export type { ImportLog, ImportedContact, ImportError } from "./useImportLogQueries";
export { useImportLogs, useImportLog, useImportedContacts, useImportErrors } from "./useImportLogQueries";
export {
  useCreateImport,
  useProcessImport,
  useToggleContactSelection,
  useTransferToPartners,
  useCreateActivitiesFromImport,
  useAnalyzeImportStructure,
  useFixImportErrors,
  useCreateImportFromParsedRows,
} from "./useImportLogActions";
export { exportErrorsToCSV } from "./useImportLogUtils";

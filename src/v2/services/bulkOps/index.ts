/**
 * SSOT API pubblica di bulkOps. Le UI importano SOLO da qui.
 */
export { runBulkOp, startBulkOp } from "./runner";
export { listScopes } from "./registry";
export type { BulkScope, BulkRunOptions, BulkRunResult, BulkItemResult } from "./types";
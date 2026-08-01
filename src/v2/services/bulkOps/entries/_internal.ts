/**
 * Marker interno per le entry: in DEV blocca chiamate dirette
 * (chi importa l'entry deve passare dal runner).
 */

import { createLogger } from "@/lib/log";
const log = createLogger("bulkOps");
export const BULK_OPS_INTERNAL = Symbol.for("bulkOps.internal");

/**
 * Da chiamare nelle entry per segnalare in dev se vengono invocate
 * fuori dal runner. In production è no-op.
 */
export function assertCalledFromRunner(scope: string): void {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV) {
    const stack = new Error().stack ?? "";
    if (!stack.includes("bulkOps/runner") && !stack.includes("bulkOps\\runner")) {
      // soft warning to console — runner manca dallo stack
      // usiamo console.warn perché è dev-only e parte di un guardrail

       
      log.warn(`[bulkOps] entry "${scope}" invocata fuori dal runner. Usa runBulkOp().`);
    }
  }
}
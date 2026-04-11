/**
 * Logger v2 — Vol. I §3.3
 *
 * Wrapper del logger v1 con API v2 e context enrichment.
 */

import { createLogger as createV1Logger } from "@/lib/log";

export function createLogger(module: string) {
  return createV1Logger(`v2:${module}`);
}

export { logConfig } from "@/lib/log";

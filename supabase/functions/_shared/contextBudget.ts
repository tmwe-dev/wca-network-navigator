/**
 * contextBudget.ts — LOVABLE-66 alias / wrapper around tokenBudget.
 *
 * The existing `tokenBudget.ts` already implements priority-based
 * assembly with truncation. This file simply re-exports the same API
 * under the name LOVABLE-66 specified, so new edge functions can import
 * `assembleContextWithBudget` consistently while preserving backward
 * compat with the existing `assembleContext` callers.
 */

export {
  estimateTokens,
  getContextBudget,
  assembleContext,
  type ContextBlock,
} from "./tokenBudget.ts";

import { assembleContext, getContextBudget, type ContextBlock } from "./tokenBudget.ts";

/**
 * Convenience wrapper: takes blocks + model name, picks the budget
 * automatically, returns assembled text + stats.
 */
export function assembleContextWithBudget(
  blocks: ContextBlock[],
  model: string,
): ReturnType<typeof assembleContext> {
  return assembleContext(blocks, getContextBudget(model));
}
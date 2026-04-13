/**
 * Pure token estimator — extracted from _shared/tokenBudget.ts Edge Function.
 * No Deno dependencies. Fully testable with Vitest.
 */

/** Rough token estimate: ~4 chars per token for mixed IT/EN text */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

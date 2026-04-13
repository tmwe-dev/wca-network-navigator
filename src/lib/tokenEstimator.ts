/**
 * Pure token estimator — extracted from _shared/tokenBudget.ts Edge Function.
 * No Deno dependencies. Fully testable with Vitest.
 */

/**
 * Estimates the number of tokens in a text string using a rough heuristic.
 * Uses ~4 characters per token, which is a reasonable approximation for mixed IT/EN text.
 *
 * @param text - The input text to estimate tokens for
 * @returns Estimated token count (rounded up), or 0 for empty/falsy input
 *
 * @example
 * estimateTokens("Hello world") // 3
 * estimateTokens("") // 0
 * estimateTokens("Buongiorno, questa è una frase di esempio.") // 11
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

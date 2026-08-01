/**
 * tokenBudget.ts — Dynamic token budget calculator for AI context assembly.
 * Estimates token counts and manages allocation across context sources.
 */

/** Rough token estimate: ~4 chars per token for mixed IT/EN text */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Context window sizes by model family */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "gemini-2.5-flash": 1_000_000,
  "gemini-3-flash-preview": 1_000_000,
  "google/gemini-2.5-flash": 1_000_000,
  "google/gemini-3-flash-preview": 1_000_000,
  "google/gemini-2.5-flash-lite": 1_000_000,
  "google/gemini-2.5-pro": 1_000_000,
  "google/gemini-3.1-pro-preview": 1_000_000,
  "gpt-5": 128_000,
  "gpt-5-mini": 128_000,
  "gpt-5-nano": 128_000,
  "openai/gpt-5": 128_000,
  "openai/gpt-5-mini": 128_000,
  "openai/gpt-5-nano": 128_000,
  "gpt-4o-mini": 128_000,
  "gpt-4o": 128_000,
  "claude-sonnet-4-20250514": 200_000,
  "claude-haiku-4-20250414": 200_000,
};

/**
 * Returns the context budget available for injected context.
 * Formula: min(contextWindow * 0.30, 32_000)
 */
export function getContextBudget(model: string): number {
  const window = MODEL_CONTEXT_WINDOWS[model] || 128_000;
  return Math.min(Math.floor(window * 0.30), 32_000);
}

export interface ContextBlock {
  key: string;
  content: string;
  priority: number;
  minTokens?: number;
}

/**
 * Assembles context blocks within the given token budget.
 * Blocks sorted by priority DESC; higher priority included first.
 */
export function assembleContext(
  blocks: ContextBlock[],
  budgetTokens: number,
): { text: string; stats: { included: string[]; truncated: string[]; dropped: string[]; totalTokens: number } } {
  const sorted = [...blocks].sort((a, b) => b.priority - a.priority);
  const included: string[] = [];
  const truncated: string[] = [];
  const dropped: string[] = [];
  let remaining = budgetTokens;
  const parts: string[] = [];

  for (const block of sorted) {
    if (!block.content?.trim()) continue;

    const blockTokens = estimateTokens(block.content);

    if (blockTokens <= remaining) {
      parts.push(block.content);
      remaining -= blockTokens;
      included.push(block.key);
    } else if (remaining >= (block.minTokens || 200)) {
      const charBudget = remaining * 4;
      const truncatedContent = block.content.slice(0, charBudget);
      const lastNewline = truncatedContent.lastIndexOf("\n");
      const cleanCut = lastNewline > charBudget * 0.5 ? truncatedContent.slice(0, lastNewline) : truncatedContent;
      parts.push(cleanCut + "\n[...contesto troncato per limiti token]");
      remaining -= estimateTokens(cleanCut);
      truncated.push(block.key);
    } else {
      dropped.push(block.key);
    }
  }

  return {
    text: parts.join("\n"),
    stats: { included, truncated, dropped, totalTokens: budgetTokens - remaining },
  };
}

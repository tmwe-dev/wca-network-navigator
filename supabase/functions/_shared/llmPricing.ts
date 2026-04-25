/**
 * llmPricing — Tabella prezzi LLM in USD per 1M token.
 * Centralizza i costi per il calcolo accurato in ai_prompt_log.
 *
 * Aggiornare quando si aggiungono nuovi modelli o cambiano i prezzi.
 */

export interface ModelPricing {
  /** USD per 1M input tokens */
  promptUsdPer1M: number;
  /** USD per 1M output tokens */
  completionUsdPer1M: number;
}

const PRICING: Record<string, ModelPricing> = {
  // Google Gemini
  "google/gemini-2.5-pro": { promptUsdPer1M: 1.25, completionUsdPer1M: 10.0 },
  "google/gemini-2.5-flash": { promptUsdPer1M: 0.30, completionUsdPer1M: 2.50 },
  "google/gemini-2.5-flash-lite": { promptUsdPer1M: 0.075, completionUsdPer1M: 0.30 },
  "google/gemini-3-flash-preview": { promptUsdPer1M: 0.30, completionUsdPer1M: 2.50 },
  "google/gemini-3.1-flash-preview": { promptUsdPer1M: 0.30, completionUsdPer1M: 2.50 },
  "google/gemini-3.1-pro-preview": { promptUsdPer1M: 1.25, completionUsdPer1M: 10.0 },
  "google/gemini-3-pro-image-preview": { promptUsdPer1M: 1.25, completionUsdPer1M: 10.0 },
  "google/gemini-3.1-flash-image-preview": { promptUsdPer1M: 0.30, completionUsdPer1M: 2.50 },

  // OpenAI
  "openai/gpt-5": { promptUsdPer1M: 2.50, completionUsdPer1M: 10.0 },
  "openai/gpt-5-mini": { promptUsdPer1M: 0.25, completionUsdPer1M: 2.0 },
  "openai/gpt-5-nano": { promptUsdPer1M: 0.05, completionUsdPer1M: 0.40 },
  "openai/gpt-5.2": { promptUsdPer1M: 2.50, completionUsdPer1M: 10.0 },
  "openai/gpt-4o-mini": { promptUsdPer1M: 0.15, completionUsdPer1M: 0.60 },
  "openai/gpt-4o": { promptUsdPer1M: 2.50, completionUsdPer1M: 10.0 },

  // Anthropic
  "anthropic/claude-3-5-sonnet": { promptUsdPer1M: 3.0, completionUsdPer1M: 15.0 },
  "anthropic/claude-3-5-haiku": { promptUsdPer1M: 0.80, completionUsdPer1M: 4.0 },
};

/** Default fallback se modello sconosciuto (Gemini Flash pricing). */
const DEFAULT_PRICING: ModelPricing = { promptUsdPer1M: 0.30, completionUsdPer1M: 2.50 };

/**
 * Stima costo in USD dato modello + tokens in/out.
 * Se modello sconosciuto, usa DEFAULT_PRICING e logga warning.
 */
export function estimateCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  // Cerca match esatto, poi prova senza prefix provider, poi default
  let pricing = PRICING[model];
  if (!pricing) {
    const stripped = model.replace(/^[^/]+\//, "");
    pricing = Object.entries(PRICING).find(([k]) => k.endsWith(stripped))?.[1] ?? DEFAULT_PRICING;
  }
  const cost = (tokensIn * pricing.promptUsdPer1M + tokensOut * pricing.completionUsdPer1M) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function getKnownModels(): string[] {
  return Object.keys(PRICING);
}

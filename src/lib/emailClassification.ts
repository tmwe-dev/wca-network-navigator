/**
 * Pure email classification parser — extracted from classify-email-response Edge Function.
 * No Deno/Supabase dependencies. Fully testable with Vitest.
 */

/** Shape of a parsed AI classification result */
export interface ClassificationResult {
  category: string;
  confidence: number;
  ai_summary: string;
  keywords: string[];
  urgency: string;
  sentiment: string;
  detected_patterns: string[];
  action_suggested: string;
  reasoning: string;
}

const VALID_CATEGORIES = [
  "interested", "not_interested", "request_info", "meeting_request",
  "complaint", "follow_up", "auto_reply", "spam", "uncategorized",
];
const VALID_URGENCY = ["critical", "high", "normal", "low"];
const VALID_SENTIMENT = ["positive", "negative", "neutral", "mixed"];

/**
 * Parses and validates raw AI classification JSON into a structured ClassificationResult.
 * Strips markdown fences, validates categories/urgency/sentiment against allow-lists,
 * clamps confidence to [0,1], and truncates string fields for safety.
 *
 * @param raw - The raw string response from the AI model (may include markdown fences)
 * @returns A validated ClassificationResult with all fields sanitized
 * @throws Error if raw is null/empty or contains invalid JSON
 *
 * @example
 * parseClassificationResponse('{"category":"interested","confidence":0.9,...}')
 * // => { category: "interested", confidence: 0.9, ... }
 *
 * @example
 * parseClassificationResponse('```json\n{"category":"spam"}\n```')
 * // => { category: "spam", confidence: 0, ... }
 */
export function parseClassificationResponse(raw: string | null): ClassificationResult {
  if (!raw) throw new Error("Empty AI response");

  // Strip markdown fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }

  const parsed = JSON.parse(cleaned);

  return {
    category: VALID_CATEGORIES.includes(parsed.category) ? parsed.category : "uncategorized",
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    ai_summary: String(parsed.ai_summary || "").substring(0, 1000),
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String).slice(0, 20) : [],
    urgency: VALID_URGENCY.includes(parsed.urgency) ? parsed.urgency : "normal",
    sentiment: VALID_SENTIMENT.includes(parsed.sentiment) ? parsed.sentiment : "neutral",
    detected_patterns: Array.isArray(parsed.detected_patterns) ? parsed.detected_patterns.map(String).slice(0, 10) : [],
    action_suggested: String(parsed.action_suggested || "").substring(0, 500),
    reasoning: String(parsed.reasoning || "").substring(0, 1000),
  };
}

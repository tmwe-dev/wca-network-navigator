import { VALID_DOMAINS, VALID_CATEGORIES, VALID_URGENCY, VALID_SENTIMENT } from "./classificationPrompts.ts";

export interface ClassificationResult {
  domain: string;
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

export function parseClassificationResponse(raw: string | null): ClassificationResult {
  if (!raw) throw new Error("Empty AI response");

  // Strip markdown fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }

  const parsed = JSON.parse(cleaned);

  return {
    domain: VALID_DOMAINS.includes(parsed.domain) ? parsed.domain : "commercial",
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

export function computeDominantSentiment(exchanges: Array<{ sentiment: string }>): string {
  const last3 = exchanges.slice(-3);
  if (!last3.length) return "neutral";
  const counts: Record<string, number> = {};
  for (const ex of last3) {
    counts[ex.sentiment] = (counts[ex.sentiment] || 0) + 1;
  }
  let max = 0;
  let dominant = "neutral";
  for (const [s, c] of Object.entries(counts)) {
    if (c > max) { max = c; dominant = s; }
  }
  return dominant;
}

export function getNextStatus(currentStatus: string, classification: { category: string; confidence: number }): string | null {
  const cat = classification.category;
  if (["interested", "meeting_request", "question", "request_info"].includes(cat)) {
    switch (currentStatus) {
      case "new": return "first_touch_sent";
      case "first_touch_sent": return "engaged";
      case "holding": return "engaged";
      case "engaged": return cat === "meeting_request" ? "qualified" : "engaged";
      case "qualified": return cat === "meeting_request" ? "negotiation" : "qualified";
      default: return null;
    }
  }
  if (cat === "not_interested" && classification.confidence >= 0.80) {
    return ["new", "first_touch_sent", "holding", "engaged"].includes(currentStatus) ? "archived" : null;
  }
  if (cat === "unsubscribe") return "blacklisted";
  if (cat === "bounce") return "archived";
  return null;
}

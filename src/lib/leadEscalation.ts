/**
 * Pure lead escalation/downgrade logic — extracted from classify-email-response Edge Function.
 * No Deno/Supabase dependencies. Fully testable with Vitest.
 */

const ESCALATION_CATEGORIES = ["interested", "meeting_request"];
const POSITIVE_SENTIMENTS = ["positive", "very_positive"];
const DOWNGRADE_ELIGIBLE_STATUSES = ["contacted", "in_progress"];

/**
 * Given classification category, sentiment, and current lead status,
 * returns the new status or null if no change.
 */
export function computeEscalation(
  category: string,
  sentiment: string,
  currentStatus: string,
): string | null {
  if (!ESCALATION_CATEGORIES.includes(category)) return null;
  if (!POSITIVE_SENTIMENTS.includes(sentiment)) return null;

  const statusMap: Record<string, string> = {
    new: "contacted",
    contacted: "in_progress",
    in_progress: category === "meeting_request" ? "negotiation" : "in_progress",
  };

  const newStatus = statusMap[currentStatus];
  if (!newStatus || newStatus === currentStatus) return null;
  return newStatus;
}

/**
 * Given classification category, confidence, and current lead status,
 * returns "lost" or null if no downgrade.
 */
export function computeDowngrade(
  category: string,
  confidence: number,
  currentStatus: string,
): string | null {
  if (category !== "not_interested") return null;
  if (confidence < 0.80) return null;
  if (!DOWNGRADE_ELIGIBLE_STATUSES.includes(currentStatus)) return null;
  return "lost";
}

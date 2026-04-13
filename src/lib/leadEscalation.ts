/**
 * Pure lead escalation/downgrade logic — extracted from classify-email-response Edge Function.
 * No Deno/Supabase dependencies. Fully testable with Vitest.
 */

const ESCALATION_CATEGORIES = ["interested", "meeting_request"];
const POSITIVE_SENTIMENTS = ["positive", "very_positive"];
const DOWNGRADE_ELIGIBLE_STATUSES = ["contacted", "in_progress"];

/**
 * Computes the next lead status based on email classification results.
 * Used by classify-email-response to auto-escalate contacts in the holding pattern.
 *
 * @param category - The email classification category (e.g., "interested", "meeting_request")
 * @param sentiment - The detected sentiment (e.g., "positive", "very_positive")
 * @param currentStatus - The contact's current lead_status (e.g., "new", "contacted", "in_progress")
 * @returns The new lead_status string, or null if no escalation is needed
 *
 * @example
 * computeEscalation("interested", "positive", "contacted") // returns "in_progress"
 * computeEscalation("spam", "neutral", "contacted") // returns null
 * computeEscalation("meeting_request", "positive", "in_progress") // returns "negotiation"
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
 * Determines if a lead should be downgraded to "lost" based on a negative classification.
 * Only downgrades leads in "contacted" or "in_progress" status with high confidence.
 *
 * @param category - The email classification category (must be "not_interested" to trigger)
 * @param confidence - The AI classification confidence score (0-1, threshold: 0.80)
 * @param currentStatus - The contact's current lead_status
 * @returns "lost" if downgrade criteria are met, null otherwise
 *
 * @example
 * computeDowngrade("not_interested", 0.95, "contacted") // returns "lost"
 * computeDowngrade("not_interested", 0.5, "contacted") // returns null (low confidence)
 * computeDowngrade("interested", 0.95, "contacted") // returns null (wrong category)
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

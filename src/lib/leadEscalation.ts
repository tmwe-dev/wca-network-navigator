/**
 * Pure lead escalation/downgrade logic — extracted from classify-email-response Edge Function.
 * No Deno/Supabase dependencies. Fully testable with Vitest.
 */

const ESCALATION_CATEGORIES = ["interested", "meeting_request"];
const POSITIVE_SENTIMENTS = ["positive", "very_positive"];
// Tassonomia 9 stati: solo first_touch_sent / holding sono eligibili al downgrade auto verso "archived"
const DOWNGRADE_ELIGIBLE_STATUSES = ["first_touch_sent", "holding"];

/**
 * Computes the next lead status based on email classification results.
 * Used by classify-email-response to auto-escalate contacts in the holding pattern.
 *
 * @param category - The email classification category (e.g., "interested", "meeting_request")
 * @param sentiment - The detected sentiment (e.g., "positive", "very_positive")
 * @param currentStatus - The contact's current lead_status (e.g., "new", "first_touch_sent", "holding", "engaged")
 * @returns The new lead_status string, or null if no escalation is needed
 *
 * @example
 * computeEscalation("interested", "positive", "first_touch_sent") // returns "engaged"
 * computeEscalation("spam", "neutral", "first_touch_sent") // returns null
 * computeEscalation("meeting_request", "positive", "engaged") // returns "qualified"
 */
export function computeEscalation(
  category: string,
  sentiment: string,
  currentStatus: string,
): string | null {
  if (!ESCALATION_CATEGORIES.includes(category)) return null;
  if (!POSITIVE_SENTIMENTS.includes(sentiment)) return null;

  // Tassonomia 9 stati canonica:
  // new → first_touch_sent → holding → engaged → qualified → negotiation → converted
  const statusMap: Record<string, string> = {
    new: "first_touch_sent",
    first_touch_sent: "engaged",
    holding: "engaged",
    engaged: category === "meeting_request" ? "qualified" : "engaged",
  };

  const newStatus = statusMap[currentStatus];
  if (!newStatus || newStatus === currentStatus) return null;
  return newStatus;
}

/**
 * Determines if a lead should be downgraded to "archived" based on a negative classification.
 * Only downgrades leads in "first_touch_sent" or "holding" status with high confidence.
 *
 * @param category - The email classification category (must be "not_interested" to trigger)
 * @param confidence - The AI classification confidence score (0-1, threshold: 0.80)
 * @param currentStatus - The contact's current lead_status
 * @returns "archived" if downgrade criteria are met, null otherwise
 */
export function computeDowngrade(
  category: string,
  confidence: number,
  currentStatus: string,
): string | null {
  if (category !== "not_interested") return null;
  if (confidence < 0.80) return null;
  if (!DOWNGRADE_ELIGIBLE_STATUSES.includes(currentStatus)) return null;
  return "archived";
}

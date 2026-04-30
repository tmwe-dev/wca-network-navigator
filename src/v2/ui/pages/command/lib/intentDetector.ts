/**
 * intentDetector — Recognises CONVERSATIONAL intents that should NOT trigger
 * a new DB query but should reuse the previous turn's result.
 *
 * Used by useCommandSubmit BEFORE the fast-lane / planner routing.
 */

/**
 * True when the user is asking the AI to summarise / explain / interpret what
 * was already returned at the previous turn (no new search intended).
 *
 * Examples that match:
 *   "cosa dice in sintesi"
 *   "riassumi"
 *   "spiega"
 *   "in breve cosa contiene"
 *   "di cosa parla"
 *   "tldr"
 *   "fai un riassunto"
 *   "in sostanza"
 */
const SYNTHESIS_RX =
  /\b(in\s+sintesi|sintesi|sintetizz\w*|riassum\w*|riassunto|in\s+breve|in\s+sostanza|in\s+poche\s+parole|spieg\w*|spiegami|cosa\s+dice|cosa\s+dicono|cosa\s+contiene|cosa\s+contengono|di\s+cosa\s+parl\w*|che\s+cosa\s+dic\w*|tl;?dr|summary|riepilog\w*|fammi\s+un\s+sunto|sunto|analizza\s+(quanto|i\s+risultat|quelli)|spiega\s+(quanto|i\s+risultat|quelli))\b/i;

export function isSynthesisIntent(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return false;
  return SYNTHESIS_RX.test(t);
}

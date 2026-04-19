/**
 * Single source of truth for the Holding Pattern lead state taxonomy.
 *
 * The Holding Pattern represents leads that are actively engaged
 * (post first contact, pre conversion). All UI, hooks, and queries
 * MUST import from this file to avoid divergent definitions.
 */

/**
 * Holding statuses = leads attivamente nel circuito di attesa,
 * post primo contatto e pre-conversione/archiviazione.
 */
export const HOLDING_STATUSES = ["first_touch_sent", "holding", "engaged"] as const;
export type HoldingStatus = typeof HOLDING_STATUSES[number];

/**
 * Tassonomia canonica 9 stati lead (Costituzione Commerciale).
 * Allineata a partners.lead_status / imported_contacts.lead_status / business_cards.lead_status / prospects.lead_status.
 */
export const ALL_LEAD_STATUSES = [
  "new",
  "first_touch_sent",
  "holding",
  "engaged",
  "qualified",
  "negotiation",
  "converted",
  "archived",
  "blacklisted",
] as const;
export type LeadStatus = typeof ALL_LEAD_STATUSES[number];

/**
 * Returns true if the given lead_status falls inside the holding pattern.
 * Handles null/undefined/unknown gracefully.
 */
export function isInHoldingPattern(status: string | null | undefined): boolean {
  return HOLDING_STATUSES.includes(status as HoldingStatus);
}

/**
 * Statuses representing "active engagement" — alias of HOLDING_STATUSES,
 * exported separately for semantic clarity in briefings/dashboards.
 */
export const ACTIVE_ENGAGEMENT_STATUSES = HOLDING_STATUSES;

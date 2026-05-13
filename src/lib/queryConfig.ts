/**
 * React Query stale-time presets for WCA Network Navigator.
 *
 * Pick the constant that matches how frequently the underlying data
 * changes so React Query can skip unnecessary refetches while still
 * keeping the UI fresh.
 */

export const STALE_TIMES = {
  /**
   * **REALTIME (0 ms)** — Data that must always be fresh on every render.
   * Use for: presence indicators, live typing status, WebSocket-backed
   * feeds where you rely on React Query only as a cache container.
   */
  REALTIME: 0,

  /**
   * **FAST (30 s)** — Data that changes frequently while the user is
   * actively working.
   * Use for: inbox message lists, pending-action queues, unread counts,
   * partner activity feeds.
   */
  FAST: 30_000,

  /**
   * **DEFAULT (5 min)** — The standard choice for most queries.
   * Use for: partner details, conversation threads, search results,
   * dashboard aggregations.
   */
  DEFAULT: 5 * 60_000,

  /**
   * **SLOW (30 min)** — Data that changes infrequently or is updated
   * by background jobs.
   * Use for: user profiles, team member lists, email classification
   * rules, operative prompt catalogues.
   */
  SLOW: 30 * 60_000,

  /**
   * **STATIC (1 h)** — Reference data that almost never changes within
   * a user session.
   * Use for: country lists, timezone enums, feature flags fetched at
   * boot, brand/design-system tokens.
   */
  STATIC: 60 * 60_000,
} as const;

/** Convenience type for stale-time values. */
export type StaleTime = (typeof STALE_TIMES)[keyof typeof STALE_TIMES];

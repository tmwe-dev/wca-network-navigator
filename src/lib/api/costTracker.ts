/**
 * CostTracker — Session-scoped AI cost tracker (client-side guardrail).
 *
 * Tracks cumulative credits consumed per browser session.
 * Warns at softLimit, blocks at hardLimit (throws BudgetExceededError).
 * Server remains source of truth for billing; this is a safety net.
 */
import { ApiError } from "@/lib/api/apiError";
import { createLogger } from "@/lib/log";

const log = createLogger("costTracker");

export interface CostTrackerConfig {
  softLimit: number;
  hardLimit: number;
}

export interface SessionStats {
  totalCredits: number;
  callCount: number;
  callsByFunction: Record<string, { count: number; credits: number }>;
}

let config: CostTrackerConfig = { softLimit: 500, hardLimit: 1000 };
let stats: SessionStats = { totalCredits: 0, callCount: 0, callsByFunction: {} };
let softLimitWarned = false;

/** Reconfigure limits (takes effect immediately). */
export function configureCostTracker(partial: Partial<CostTrackerConfig>) {
  config = { ...config, ...partial };
  softLimitWarned = false;
}

/** Throws ApiError(RATE_LIMITED) if session hard limit is exceeded. */
export function checkBudget(): void {
  if (stats.totalCredits >= config.hardLimit) {
    log.warn("hard limit reached", { stats, config });
    throw new ApiError({
      code: "RATE_LIMITED",
      message: `Budget sessione esaurito (${stats.totalCredits}/${config.hardLimit} crediti)`,
      details: { totalCredits: stats.totalCredits, hardLimit: config.hardLimit },
    });
  }
}

/**
 * Record cost after a successful AI call.
 * Returns true if soft limit was just crossed (caller can show a toast).
 */
export function trackCost(functionName: string, credits: number): boolean {
  if (credits <= 0) return false;

  stats.totalCredits += credits;
  stats.callCount += 1;

  const entry = stats.callsByFunction[functionName] ?? { count: 0, credits: 0 };
  entry.count += 1;
  entry.credits += credits;
  stats.callsByFunction[functionName] = entry;

  log.info("tracked", { functionName, credits, total: stats.totalCredits });

  if (!softLimitWarned && stats.totalCredits >= config.softLimit) {
    softLimitWarned = true;
    return true; // signal: caller should warn user
  }
  return false;
}

/** Returns a snapshot of session usage. */
export function getSessionStats(): Readonly<SessionStats> {
  return { ...stats, callsByFunction: { ...stats.callsByFunction } };
}

/** Resets all session counters. */
export function resetSession(): void {
  stats = { totalCredits: 0, callCount: 0, callsByFunction: {} };
  softLimitWarned = false;
}

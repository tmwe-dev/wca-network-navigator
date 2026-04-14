/**
 * Browser-side work-hours utilities.
 * Mirrors the semantics of supabase/functions/_shared/timeUtils.ts
 * but runs in the browser — no edge imports.
 */

/** Returns current hour in CET/CEST (Europe/Rome), 0-23. */
export function getCETHour(): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    hour: "numeric",
    hour12: false,
  });
  return parseInt(formatter.format(new Date()), 10);
}

/** True when current CET hour is outside [startHour, endHour). */
export function isOutsideWorkHours(startHour: number, endHour: number): boolean {
  const hour = getCETHour();
  if (endHour <= startHour) return false; // misconfigured → never pause
  return hour < startHour || hour >= endHour;
}

/**
 * Milliseconds until the next `startHour` CET.
 * If today's startHour hasn't passed yet, returns ms until today's.
 * Otherwise returns ms until tomorrow's.
 * Adds no jitter — caller should add random(0, 15min) on top.
 */
export function msUntilNextWorkStart(startHour: number): number {
  const now = new Date();

  // Build a Date object for today at startHour in Europe/Rome
  // We iterate to find the exact UTC instant when CET == startHour
  const todayTarget = new Date(now);
  todayTarget.setUTCHours(startHour - 1, 0, 0, 0); // rough estimate (CET ≈ UTC+1/+2)

  // Refine: adjust until the CET hour matches
  const getHourInCET = (d: Date) => {
    const f = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Rome",
      hour: "numeric",
      hour12: false,
    });
    return parseInt(f.format(d), 10);
  };

  // Simple approach: compute offset from CET to UTC
  const cetOffsetMs = (() => {
    const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const cetHourAtUtcMidnight = getHourInCET(utcMidnight);
    return cetHourAtUtcMidnight * 3600_000;
  })();

  // Target UTC = today UTC midnight + startHour*3600s - cetOffset
  const todayUTCMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let targetMs = todayUTCMidnight + startHour * 3600_000 - cetOffsetMs;

  if (targetMs <= now.getTime()) {
    // Already passed today — aim for tomorrow
    targetMs += 24 * 3600_000;
  }

  return Math.max(0, targetMs - now.getTime());
}

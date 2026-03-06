/**
 * WCA Timing Checkpoint — Global Gate
 * 
 * Every WCA request MUST pass through this checkpoint before executing.
 * The checkpoint enforces a minimum delay between requests (green zone = ≥15s).
 * If the elapsed time since the last request is below the green threshold,
 * the checkpoint WAITS until we reach green before returning true.
 * 
 * This is the SINGLE source of truth for WCA request timing authorization.
 */

const CHECKPOINT_KEY = '__wcaCheckpoint__';

interface CheckpointState {
  lastRequestTs: number;  // timestamp of the last WCA request (ms)
}

function getState(): CheckpointState {
  if (!(window as any)[CHECKPOINT_KEY]) {
    (window as any)[CHECKPOINT_KEY] = { lastRequestTs: 0 };
  }
  return (window as any)[CHECKPOINT_KEY];
}

/** Green zone threshold in seconds (raised from 15 to 20 to reduce WCA anti-bot triggers) */
let GREEN_ZONE_SECONDS = 20;

/**
 * Dynamically increase the checkpoint delay when rate-limiting is detected.
 * Call with seconds=30 to activate backoff, or seconds=20 to reset.
 */
export function setGreenZoneDelay(seconds: number): void {
  GREEN_ZONE_SECONDS = Math.max(15, Math.min(60, seconds));
  
}

export function getGreenZoneDelay(): number {
  return GREEN_ZONE_SECONDS;
}

/**
 * Returns seconds elapsed since the last WCA request.
 */
export function getElapsedSinceLastRequest(): number {
  const state = getState();
  if (state.lastRequestTs === 0) return Infinity;
  return Math.floor((Date.now() - state.lastRequestTs) / 1000);
}

/**
 * Returns true if we're in the green zone (safe to send).
 */
export function isGreenZone(): boolean {
  return getElapsedSinceLastRequest() >= GREEN_ZONE_SECONDS;
}

/**
 * Records that a WCA request was just sent (call AFTER the request fires).
 */
export function markRequestSent(): void {
  getState().lastRequestTs = Date.now();
}

/**
 * Returns the last request timestamp (for gauge display).
 */
export function getLastRequestTimestamp(): number {
  return getState().lastRequestTs;
}

/**
 * THE CHECKPOINT GATE.
 * 
 * Waits until the green zone is reached (≥15s since last request),
 * then returns true = authorized.
 * 
 * If the AbortSignal fires while waiting, returns false = denied.
 * 
 * @param signal - Optional AbortSignal for cancellation
 * @param onWaiting - Optional callback with seconds remaining (for logging)
 */
export async function waitForGreenLight(
  signal?: AbortSignal,
  onWaiting?: (secondsRemaining: number) => void
): Promise<boolean> {
  // If no previous request, immediately green
  const state = getState();
  if (state.lastRequestTs === 0) return true;

  while (true) {
    if (signal?.aborted) return false;

    const elapsedMs = Date.now() - state.lastRequestTs;
    const elapsedSec = elapsedMs / 1000;

    if (elapsedSec >= GREEN_ZONE_SECONDS) {
      return true; // ✅ GREEN — authorized
    }

    const remaining = Math.ceil(GREEN_ZONE_SECONDS - elapsedSec);
    if (onWaiting) onWaiting(remaining);

    // Wait 1 second, then check again
    try {
      await new Promise<void>((resolve, reject) => {
        if (signal?.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
        const t = setTimeout(resolve, 1000);
        signal?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
      });
    } catch {
      return false; // Aborted
    }
  }
}

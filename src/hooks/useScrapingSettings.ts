/**
 * SIMPLIFIED shim — scraping settings are no longer stored in DB.
 * Returns hardcoded defaults. Kept for backward compatibility with
 * AcquisitionToolbar, ProspectImporter, ResyncConfigure, etc.
 */

export interface ScrapingSettings {
  baseDelay: number;
  variation: number;
  keepAliveMs: number;
  excludeThreshold: number;
  maxRetries: number;
  randomPause: boolean;
}

const DEFAULTS: ScrapingSettings = {
  baseDelay: 15,
  variation: 3,
  keepAliveMs: 30000,
  excludeThreshold: 3,
  maxRetries: 0,
  randomPause: false,
};

const HUMAN_PAUSE_PATTERN = [2, 19, 4, 3, 22, 5, 4, 7, 18, 4, 25, 3, 7, 13, 3, 11];
const MIN_OPERATION_DURATION_MS = 16000;

export function useScrapingSettings(): { settings: ScrapingSettings; isLoading: boolean } {
  return { settings: DEFAULTS, isLoading: false };
}

/** Get the next pause from the pattern (cycles). Returns seconds. */
export function getPatternPause(index: number): number {
  return HUMAN_PAUSE_PATTERN[index % HUMAN_PAUSE_PATTERN.length];
}

/**
 * Ensure an operation took at least MIN_OPERATION_DURATION_MS.
 * Call with the start timestamp; it waits the remaining time if needed.
 */
export async function ensureMinDuration(startMs: number): Promise<void> {
  const elapsed = Date.now() - startMs;
  if (elapsed < MIN_OPERATION_DURATION_MS) {
    await new Promise(r => setTimeout(r, MIN_OPERATION_DURATION_MS - elapsed));
  }
}

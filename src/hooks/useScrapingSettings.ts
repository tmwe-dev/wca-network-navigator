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

export const SCRAPING_KEY_MAP: Record<keyof ScrapingSettings, string> = {
  baseDelay: "scraping_base_delay",
  variation: "scraping_variation",
  keepAliveMs: "scraping_keepalive_ms",
  excludeThreshold: "scraping_exclude_threshold",
  maxRetries: "scraping_max_retries",
  randomPause: "scraping_random_pause",
};

export const SCRAPING_DEFAULTS = DEFAULTS;

export function useScrapingSettings(): { settings: ScrapingSettings; isLoading: boolean } {
  return { settings: DEFAULTS, isLoading: false };
}

/** Calculate a random delay: baseDelay +/- variation, with hard floor of 10s */
export function calcDelay(baseDelay: number, variation: number): number {
  const offset = Math.floor(Math.random() * (variation * 2 + 1)) - variation;
  return Math.max(baseDelay + offset, 10);
}

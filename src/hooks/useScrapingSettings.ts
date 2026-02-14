import { useMemo } from "react";
import { useAppSettings } from "./useAppSettings";

export interface ScrapingSettings {
  baseDelay: number;
  variation: number;
  keepAliveMs: number;
  excludeThreshold: number;
  maxRetries: number;
}

const DEFAULTS: ScrapingSettings = {
  baseDelay: 15,
  variation: 3,
  keepAliveMs: 30000,
  excludeThreshold: 3,
  maxRetries: 2,
};

const KEY_MAP: Record<keyof ScrapingSettings, string> = {
  baseDelay: "scraping_base_delay",
  variation: "scraping_variation",
  keepAliveMs: "scraping_keepalive_ms",
  excludeThreshold: "scraping_exclude_threshold",
  maxRetries: "scraping_max_retries",
};

export const SCRAPING_KEY_MAP = KEY_MAP;
export const SCRAPING_DEFAULTS = DEFAULTS;

function parseNum(val: string | undefined, fallback: number): number {
  if (!val) return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

export function useScrapingSettings(): { settings: ScrapingSettings; isLoading: boolean } {
  const { data: raw, isLoading } = useAppSettings();

  const settings = useMemo<ScrapingSettings>(() => {
    if (!raw) return DEFAULTS;
    return {
      baseDelay: parseNum(raw[KEY_MAP.baseDelay], DEFAULTS.baseDelay),
      variation: parseNum(raw[KEY_MAP.variation], DEFAULTS.variation),
      keepAliveMs: parseNum(raw[KEY_MAP.keepAliveMs], DEFAULTS.keepAliveMs),
      excludeThreshold: parseNum(raw[KEY_MAP.excludeThreshold], DEFAULTS.excludeThreshold),
      maxRetries: parseNum(raw[KEY_MAP.maxRetries], DEFAULTS.maxRetries),
    };
  }, [raw]);

  return { settings, isLoading };
}

/** Calculate a random delay: baseDelay +/- variation, with hard floor of 10s */
export function calcDelay(baseDelay: number, variation: number): number {
  const offset = Math.floor(Math.random() * (variation * 2 + 1)) - variation;
  return Math.max(baseDelay + offset, 10);
}

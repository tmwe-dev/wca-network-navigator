import { useMemo } from "react";
import { useAppSettings } from "./useAppSettings";

export interface ScrapingSettings {
  delayMin: number;
  delayMax: number;
  delayDefault: number;
  avgScrapeTime: number;
  keepAliveMs: number;
  excludeThreshold: number;
  recoveryThreshold: number;
  throttleGapMs: number;
  recoveryWait1: number;
  recoveryWait2: number;
  recoveryWait3: number;
  maxRetries: number;
  pauseEveryN: number;
  pauseDurationS: number;
  nightPause: boolean;
  nightStopHour: number;
  nightStartHour: number;
  enrichDefault: boolean;
  deepSearchDefault: boolean;
}

const DEFAULTS: ScrapingSettings = {
  delayMin: 10,
  delayMax: 60,
  delayDefault: 15,
  avgScrapeTime: 15,
  keepAliveMs: 30000,
  excludeThreshold: 3,
  recoveryThreshold: 3,
  throttleGapMs: 120000,
  recoveryWait1: 3000,
  recoveryWait2: 10000,
  recoveryWait3: 30000,
  maxRetries: 2,
  pauseEveryN: 0,
  pauseDurationS: 300,
  nightPause: false,
  nightStopHour: 2,
  nightStartHour: 7,
  enrichDefault: false,
  deepSearchDefault: false,
};

const KEY_MAP: Record<keyof ScrapingSettings, string> = {
  delayMin: "scraping_delay_min",
  delayMax: "scraping_delay_max",
  delayDefault: "scraping_delay_default",
  avgScrapeTime: "scraping_avg_time",
  keepAliveMs: "scraping_keepalive_ms",
  excludeThreshold: "scraping_exclude_threshold",
  recoveryThreshold: "scraping_recovery_threshold",
  throttleGapMs: "scraping_throttle_gap_ms",
  recoveryWait1: "scraping_recovery_wait_1",
  recoveryWait2: "scraping_recovery_wait_2",
  recoveryWait3: "scraping_recovery_wait_3",
  maxRetries: "scraping_max_retries",
  pauseEveryN: "scraping_pause_every_n",
  pauseDurationS: "scraping_pause_duration_s",
  nightPause: "scraping_night_pause",
  nightStopHour: "scraping_night_stop_hour",
  nightStartHour: "scraping_night_start_hour",
  enrichDefault: "scraping_enrich_default",
  deepSearchDefault: "scraping_deep_search_default",
};

export const SCRAPING_KEY_MAP = KEY_MAP;
export const SCRAPING_DEFAULTS = DEFAULTS;

function parseNum(val: string | undefined, fallback: number): number {
  if (!val) return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function parseBool(val: string | undefined, fallback: boolean): boolean {
  if (val === undefined || val === null) return fallback;
  return val === "true";
}

export function useScrapingSettings(): { settings: ScrapingSettings; isLoading: boolean } {
  const { data: raw, isLoading } = useAppSettings();

  const settings = useMemo<ScrapingSettings>(() => {
    if (!raw) return DEFAULTS;
    return {
      delayMin: parseNum(raw[KEY_MAP.delayMin], DEFAULTS.delayMin),
      delayMax: parseNum(raw[KEY_MAP.delayMax], DEFAULTS.delayMax),
      delayDefault: parseNum(raw[KEY_MAP.delayDefault], DEFAULTS.delayDefault),
      avgScrapeTime: parseNum(raw[KEY_MAP.avgScrapeTime], DEFAULTS.avgScrapeTime),
      keepAliveMs: parseNum(raw[KEY_MAP.keepAliveMs], DEFAULTS.keepAliveMs),
      excludeThreshold: parseNum(raw[KEY_MAP.excludeThreshold], DEFAULTS.excludeThreshold),
      recoveryThreshold: parseNum(raw[KEY_MAP.recoveryThreshold], DEFAULTS.recoveryThreshold),
      throttleGapMs: parseNum(raw[KEY_MAP.throttleGapMs], DEFAULTS.throttleGapMs),
      recoveryWait1: parseNum(raw[KEY_MAP.recoveryWait1], DEFAULTS.recoveryWait1),
      recoveryWait2: parseNum(raw[KEY_MAP.recoveryWait2], DEFAULTS.recoveryWait2),
      recoveryWait3: parseNum(raw[KEY_MAP.recoveryWait3], DEFAULTS.recoveryWait3),
      maxRetries: parseNum(raw[KEY_MAP.maxRetries], DEFAULTS.maxRetries),
      pauseEveryN: parseNum(raw[KEY_MAP.pauseEveryN], DEFAULTS.pauseEveryN),
      pauseDurationS: parseNum(raw[KEY_MAP.pauseDurationS], DEFAULTS.pauseDurationS),
      nightPause: parseBool(raw[KEY_MAP.nightPause], DEFAULTS.nightPause),
      nightStopHour: parseNum(raw[KEY_MAP.nightStopHour], DEFAULTS.nightStopHour),
      nightStartHour: parseNum(raw[KEY_MAP.nightStartHour], DEFAULTS.nightStartHour),
      enrichDefault: parseBool(raw[KEY_MAP.enrichDefault], DEFAULTS.enrichDefault),
      deepSearchDefault: parseBool(raw[KEY_MAP.deepSearchDefault], DEFAULTS.deepSearchDefault),
    };
  }, [raw]);

  return { settings, isLoading };
}

/** Build DELAY_VALUES array dynamically from min/max */
export function buildDelayValues(min: number, max: number): number[] {
  const all = [0, 1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120];
  return all.filter((v) => v >= min && v <= max);
}

/** Build DELAY_LABELS from values */
export function buildDelayLabels(values: number[]): Record<number, string> {
  const labels: Record<number, string> = {};
  for (const v of values) {
    labels[v] = v >= 60 ? `${(v / 60).toFixed(v % 60 ? 1 : 0)}m` : `${v}s`;
  }
  return labels;
}

/** Check if current time is within night pause window */
export function isNightPauseActive(nightPause: boolean, stopHour: number, startHour: number): boolean {
  if (!nightPause) return false;
  const hour = new Date().getHours();
  if (stopHour < startHour) {
    // e.g. stop at 2, start at 7 → pause between 2-7
    return hour >= stopHour && hour < startHour;
  } else {
    // e.g. stop at 22, start at 6 → pause between 22-6
    return hour >= stopHour || hour < startHour;
  }
}

/** Calculate ms until night pause ends */
export function msUntilNightEnd(startHour: number): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(startHour, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

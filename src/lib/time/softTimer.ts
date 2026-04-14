/**
 * Soft Timer — multimodal delay distribution for stealth polling.
 * Produces human-like, non-repetitive intervals.
 */

export interface SoftTimerConfig {
  readonly baseIntervalSec: number;       // e.g. 120
  readonly jitterPct: number;             // e.g. 25 → ±25%
  readonly longPauseChancePct: number;    // e.g. 10
  readonly longPauseMinMult: number;      // e.g. 1.8
  readonly longPauseMaxMult: number;      // e.g. 3.5
  readonly quickCheckChancePct: number;   // e.g. 5
  readonly quickCheckMinMult: number;     // e.g. 0.5
  readonly quickCheckMaxMult: number;     // e.g. 0.8
  readonly antiRepeatToleranceMs: number; // e.g. 1500
}

export type DelayPattern = "normal" | "long_pause" | "quick_check";

export interface DelayResult {
  readonly delayMs: number;
  readonly pattern: DelayPattern;
}

function computeDelay(cfg: SoftTimerConfig): DelayResult {
  const roll = Math.random();
  const lpThreshold = cfg.longPauseChancePct / 100;
  const qcThreshold = (cfg.longPauseChancePct + cfg.quickCheckChancePct) / 100;

  let mult: number;
  let pattern: DelayPattern;

  if (roll < lpThreshold) {
    mult = cfg.longPauseMinMult + Math.random() * (cfg.longPauseMaxMult - cfg.longPauseMinMult);
    pattern = "long_pause";
  } else if (roll < qcThreshold) {
    mult = cfg.quickCheckMinMult + Math.random() * (cfg.quickCheckMaxMult - cfg.quickCheckMinMult);
    pattern = "quick_check";
  } else {
    const jit = (Math.random() * 2 - 1) * (cfg.jitterPct / 100);
    mult = 1 + jit;
    pattern = "normal";
  }

  return {
    delayMs: Math.round(cfg.baseIntervalSec * 1000 * mult),
    pattern,
  };
}

/**
 * Compute the next delay in ms.
 * If `previousMs` is provided and the new delay is too close, rerolls once.
 */
export function nextDelayMs(cfg: SoftTimerConfig, previousMs?: number): DelayResult {
  let result = computeDelay(cfg);

  if (previousMs !== undefined && Math.abs(result.delayMs - previousMs) < cfg.antiRepeatToleranceMs) {
    // Reroll once with extra push
    const jit = (Math.random() * 2 - 1) * (cfg.jitterPct / 100);
    const mult = 1 + jit * 1.3;
    result = {
      delayMs: Math.round(cfg.baseIntervalSec * 1000 * mult),
      pattern: "normal",
    };
  }

  // Safety clamp: never negative, never > 10x base
  const maxMs = cfg.baseIntervalSec * 1000 * 10;
  result = {
    ...result,
    delayMs: Math.max(1000, Math.min(result.delayMs, maxMs)),
  };

  return result;
}

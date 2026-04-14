export type { AtecoRank } from "./types";
export { calcScore } from "./types";
import type { AtecoRank } from "./types";
import { ATECO_RANKING_1 } from "./ranking1";
import { ATECO_RANKING_2 } from "./ranking2";
import { ATECO_RANKING_3 } from "./ranking3";

export const ATECO_RANKING: Record<string, AtecoRank> = {
  ...ATECO_RANKING_1,
  ...ATECO_RANKING_2,
  ...ATECO_RANKING_3,
};

/** Get ranking for a code. Falls back to parent division if not found. */
export function getAtecoRank(code: string): AtecoRank | null {
  if (ATECO_RANKING[code]) return ATECO_RANKING[code];
  const parent = code.split(".")[0];
  if (parent !== code && ATECO_RANKING[parent]) return ATECO_RANKING[parent];
  return null;
}

/** Star string for a 1-5 value */
export function starsString(n: number): string {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

/** Color class for score */
export function scoreColor(score: number, isDark: boolean): string {
  if (score >= 16) return isDark ? "text-emerald-400" : "text-emerald-600";
  if (score >= 12) return isDark ? "text-sky-400" : "text-sky-600";
  if (score >= 8) return isDark ? "text-amber-400" : "text-amber-600";
  if (score >= 4) return isDark ? "text-orange-400" : "text-orange-500";
  return isDark ? "text-slate-600" : "text-slate-400";
}

/** Bg class for inline badge */
export function scoreBg(score: number, isDark: boolean): string {
  if (score >= 16) return isDark ? "bg-emerald-500/15 border-emerald-500/25" : "bg-emerald-50 border-emerald-200";
  if (score >= 12) return isDark ? "bg-sky-500/15 border-sky-500/25" : "bg-sky-50 border-sky-200";
  if (score >= 8) return isDark ? "bg-amber-500/15 border-amber-500/25" : "bg-amber-50 border-amber-200";
  if (score >= 4) return isDark ? "bg-orange-500/15 border-orange-500/25" : "bg-orange-50 border-orange-200";
  return isDark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200";
}

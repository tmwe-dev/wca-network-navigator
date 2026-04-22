/**
 * promptHelpers.ts — Utility functions for prompt building.
 */
import type { Quality } from "../_shared/kbSlice.ts";

export function getProfileTruncation(quality: Quality): { description: number; rawProfile: number } {
  // LOVABLE-77: raised limits — Standard now 800/2500, Premium 1500/5000.
  // Rationale: Gemini 3 Flash supports 1M tokens; better to give rich context than cut it.
  if (quality === "fast") return { description: 200, rawProfile: 0 };
  if (quality === "standard") return { description: 800, rawProfile: 2500 };
  return { description: 1500, rawProfile: 5000 };
}

export function getModel(quality: Quality): string {
  return quality === "fast"
    ? "google/gemini-2.5-flash-lite"
    : "google/gemini-3-flash-preview";
}

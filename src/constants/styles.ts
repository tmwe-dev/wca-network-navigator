/**
 * Semantic style constants — Single source of truth for the 3 color families.
 * Maps to CSS variables defined in index.css / tailwind.config.ts.
 */

/** Primary — actions, active indicators, buttons */
export const COLOR_PRIMARY = {
  bg: "bg-primary",
  text: "text-primary",
  border: "border-primary",
  foreground: "text-primary-foreground",
  bgForeground: "bg-primary text-primary-foreground",
} as const;

/** Success — positive states, online, verified */
export const COLOR_SUCCESS = {
  bg: "bg-emerald-500",
  text: "text-emerald-500",
  border: "border-emerald-500",
  muted: "text-emerald-400",
  dot: "bg-emerald-500",
} as const;

/** Destructive — errors, warnings, danger actions */
export const COLOR_DESTRUCTIVE = {
  bg: "bg-destructive",
  text: "text-destructive",
  border: "border-destructive",
  foreground: "text-destructive-foreground",
  bgForeground: "bg-destructive text-destructive-foreground",
} as const;

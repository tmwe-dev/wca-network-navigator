/**
 * ScorePill — pill compatto per uno score 0-100.
 * Tono dinamico: rosso < 40, ambra 40-69, verde >= 70.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ScorePillProps {
  value?: number | null;
  /** Label opzionale a sinistra (default: nessuna). */
  label?: string;
  className?: string;
}

export function ScorePill({ value, label, className }: ScorePillProps): React.ReactElement | null {
  if (value == null || Number.isNaN(value)) return null;
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const tone =
    v >= 70
      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
      : v >= 40
      ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
      : "bg-destructive/10 text-destructive border-destructive/30";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0 text-[9px] font-semibold rounded border leading-tight",
        tone,
        className
      )}
      title={`Score: ${v}/100`}
    >
      {label && <span className="opacity-70 font-normal">{label}</span>}
      {v}
    </span>
  );
}

export default ScorePill;
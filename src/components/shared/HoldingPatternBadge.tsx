/**
 * HoldingPatternBadge — Visual indicator of interaction/holding status.
 * Shows colored dot based on recency of last interaction.
 */
import { cn } from "@/lib/utils";
import { Plane } from "lucide-react";

interface HoldingPatternBadgeProps {
  interactionCount: number;
  lastInteractionAt?: string | null;
  size?: "sm" | "md";
}

function getDaysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function getStatus(days: number | null): { color: string; pulse: boolean; label: string } {
  if (days === null) return { color: "bg-muted-foreground/40", pulse: false, label: "In circuito" };
  if (days < 7) return { color: "bg-emerald-500", pulse: true, label: "Attivo" };
  if (days < 30) return { color: "bg-yellow-500", pulse: false, label: "Warming" };
  if (days < 90) return { color: "bg-orange-500", pulse: false, label: "Cooling" };
  return { color: "bg-red-500", pulse: false, label: "Stale" };
}

export function HoldingPatternBadge({ interactionCount, lastInteractionAt, size = "sm" }: HoldingPatternBadgeProps) {
  if (interactionCount <= 0) {
    if (size === "md") {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
          Mai contattato
        </span>
      );
    }
    return null;
  }

  const days = getDaysSince(lastInteractionAt);
  const { color, pulse, label } = getStatus(days);

  if (size === "sm") {
    return (
      <span
        className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", color, pulse && "animate-pulse")}
        title={label}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-medium text-foreground/70">
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", color, pulse && "animate-pulse")} />
      <Plane className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

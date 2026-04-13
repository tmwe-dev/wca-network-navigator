/**
 * HoldingPatternBadge — Visual indicator of interaction/holding status.
 * Shows colored dot based on recency of last interaction.
 */
import { cn } from "@/lib/utils";
import { Plane } from "lucide-react";
import { useTranslation } from "react-i18next";

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

type StatusKey = "in_circuit" | "active" | "warming" | "cooling" | "stale";

function getStatus(days: number | null): { color: string; pulse: boolean; labelKey: StatusKey } {
  if (days === null) return { color: "bg-muted-foreground/40", pulse: false, labelKey: "in_circuit" };
  if (days < 7) return { color: "bg-emerald-500", pulse: true, labelKey: "active" };
  if (days < 30) return { color: "bg-yellow-500", pulse: false, labelKey: "warming" };
  if (days < 90) return { color: "bg-orange-500", pulse: false, labelKey: "cooling" };
  return { color: "bg-red-500", pulse: false, labelKey: "stale" };
}

export function HoldingPatternBadge({ interactionCount, lastInteractionAt, size = "sm" }: HoldingPatternBadgeProps) {
  const { t } = useTranslation();

  if (interactionCount <= 0) {
    if (size === "md") {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
          {t("holding.never_contacted")}
        </span>
      );
    }
    return null;
  }

  const days = getDaysSince(lastInteractionAt);
  const { color, pulse, labelKey } = getStatus(days);
  const label = t(`holding.${labelKey}`);

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

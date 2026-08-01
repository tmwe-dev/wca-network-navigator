/**
 * SherlockLevelBadge — Mostra il livello max di Deep Search Sherlock
 * eseguito su un partner/contatto: 1=Scout, 2=Detective, 3=Sherlock.
 */
import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, ScanSearch, Telescope } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Props = {
  level: 1 | 2 | 3 | null | undefined;
  completedAt?: string | null;
  size?: "sm" | "md";
  className?: string;
};

const META: Record<1 | 2 | 3, { label: string; Icon: typeof Search; color: string }> = {
  1: { label: "Scout", Icon: Search, color: "text-muted-foreground" },
  2: { label: "Detective", Icon: ScanSearch, color: "text-primary" },
  3: { label: "Sherlock", Icon: Telescope, color: "text-amber-500" },
};

export function SherlockLevelBadge({ level, completedAt, size = "sm", className }: Props): React.ReactElement | null {
  if (!level) return null;
  const meta = META[level];
  const Icon = meta.Icon;
  const dim = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const dateLabel = completedAt
    ? format(new Date(completedAt), "d MMM yyyy", { locale: it })
    : null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("inline-flex items-center gap-0.5 rounded px-1 py-0.5", meta.color, className)}
          aria-label={`Deep Search livello ${level} — ${meta.label}`}
        >
          <Icon className={cn(dim, "shrink-0")} strokeWidth={2} />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Deep Search L{level} · {meta.label}
        {dateLabel ? ` — ${dateLabel}` : ""}
      </TooltipContent>
    </Tooltip>
  );
}

export default SherlockLevelBadge;
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HoldingPatternBadgeProps {
  readonly interactionCount: number;
  readonly lastInteractionAt?: string | null;
  readonly size?: "sm" | "md";
}

function getCircuitStatus(interactionCount: number, lastInteractionAt?: string | null) {
  if (interactionCount === 0) {
    return { color: "bg-muted-foreground", pulse: false, label: "Mai contattato", key: "none" };
  }
  if (!lastInteractionAt) {
    return { color: "bg-emerald-500", pulse: false, label: "In circuito", key: "active" };
  }
  const daysSince = Math.floor((Date.now() - new Date(lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince < 7) return { color: "bg-emerald-500", pulse: true, label: "Attivo", key: "active" };
  if (daysSince < 30) return { color: "bg-yellow-500", pulse: false, label: "In attesa", key: "warming" };
  if (daysSince < 90) return { color: "bg-orange-500", pulse: false, label: "Raffreddamento", key: "cooling" };
  return { color: "bg-red-500", pulse: false, label: "Stale", key: "stale" };
}

export function HoldingPatternBadge({ interactionCount, lastInteractionAt, size = "sm" }: HoldingPatternBadgeProps) {
  const status = getCircuitStatus(interactionCount, lastInteractionAt);

  if (size === "sm") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-block w-1.5 h-1.5 rounded-full shrink-0",
              status.color,
              status.pulse && "animate-pulse"
            )}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px]">
          {status.label} {interactionCount > 0 && `(${interactionCount})`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <span
        className={cn(
          "inline-block w-2 h-2 rounded-full shrink-0",
          status.color,
          status.pulse && "animate-pulse"
        )}
      />
      {status.label}
      {interactionCount > 0 && <span className="font-mono">({interactionCount})</span>}
    </span>
  );
}

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  score: number | null | undefined;
  breakdown?: Record<string, number> | null;
  size?: "sm" | "md";
}

function getScoreColor(score: number): string {
  if (score >= 81) return "bg-emerald-600";
  if (score >= 61) return "bg-emerald-500/80";
  if (score >= 31) return "bg-amber-500";
  return "bg-destructive/70";
}

function getScoreLabel(score: number): string {
  if (score >= 81) return "Ottimo";
  if (score >= 61) return "Buono";
  if (score >= 31) return "Medio";
  return "Basso";
}

export function LeadScoreBadge({ score, breakdown, size = "sm" }: Props) {
  const s = score ?? 0;
  const width = size === "sm" ? "w-10" : "w-14";
  const height = size === "sm" ? "h-1.5" : "h-2";

  const content = (
    <div className="flex items-center gap-1.5">
      <span className={cn("text-[10px] font-bold tabular-nums", s >= 61 ? "text-emerald-400" : s >= 31 ? "text-amber-400" : "text-destructive")}>{s}</span>
      <div className={cn(width, height, "rounded-full bg-muted/50 overflow-hidden")}>
        <div className={cn("h-full rounded-full transition-all", getScoreColor(s))} style={{ width: `${Math.min(s, 100)}%` }} />
      </div>
    </div>
  );

  if (!breakdown || Object.keys(breakdown).length === 0) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent className="text-[10px] space-y-0.5 max-w-48">
        <p className="font-semibold mb-1">Score {s}/100 — {getScoreLabel(s)}</p>
        {Object.entries(breakdown).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium">+{v}</span>
          </div>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

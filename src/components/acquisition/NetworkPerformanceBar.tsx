import { Ban, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NetworkStats {
  success: number;
  empty: number;
}

interface NetworkPerformanceBarProps {
  stats: Record<string, NetworkStats>;
  excludedNetworks: Set<string>;
  onExclude: (network: string) => void;
  onReinclude: (network: string) => void;
}

export function NetworkPerformanceBar({ stats, excludedNetworks, onExclude, onReinclude }: NetworkPerformanceBarProps) {
  const entries = Object.entries(stats)
    .filter(([, s]) => s.success + s.empty > 0)
    .sort((a, b) => {
      const rateA = a[1].success / (a[1].success + a[1].empty);
      const rateB = b[1].success / (b[1].success + b[1].empty);
      return rateA - rateB;
    });

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 rounded-lg bg-card/80 backdrop-blur-sm border border-border text-xs">
      <span className="font-medium text-muted-foreground mr-1">Network:</span>
      {entries.map(([name, s]) => {
        const total = s.success + s.empty;
        const rate = total > 0 ? Math.round((s.success / total) * 100) : 0;
        const isExcluded = excludedNetworks.has(name);

        const colorClass = isExcluded
          ? "bg-muted/50 text-muted-foreground line-through"
          : rate > 50
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : rate >= 10
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-destructive/10 text-destructive";

        return (
          <div
            key={name}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all",
              colorClass
            )}
          >
            {rate > 50 ? (
              <TrendingUp className="w-3 h-3" />
            ) : rate < 10 && !isExcluded ? (
              <TrendingDown className="w-3 h-3" />
            ) : null}
            <span className="font-medium truncate max-w-[140px]">{name}</span>
            <span className="opacity-70">{s.success}/{total}</span>
            <span className="opacity-50">({rate}%)</span>

            {isExcluded ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] hover:bg-primary/10"
                onClick={() => onReinclude(name)}
              >
                Riattiva
              </Button>
            ) : rate < 50 && total >= 3 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-destructive hover:bg-destructive/10"
                onClick={() => onExclude(name)}
              >
                <Ban className="w-3 h-3 mr-0.5" />
                Escludi
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

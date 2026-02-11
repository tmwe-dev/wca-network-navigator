import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface NetworkStats {
  success: number;
  empty: number;
}

const NETWORK_LOGOS: Record<string, string> = {
  "wca inter global": "/logos/wca-inter-global.png",
  "wca china global": "/logos/wca-china-global.png",
  "wca first": "/logos/wca-first.png",
  "wca advanced professionals": "/logos/wca-advanced-professionals.png",
  "wca projects": "/logos/wca-projects.png",
  "wca dangerous goods": "/logos/wca-dangerous-goods.png",
  "wca perishables": "/logos/wca-perishables.png",
  "wca time critical": "/logos/wca-time-critical.png",
  "wca pharma": "/logos/wca-pharma.png",
  "wca ecommerce": "/logos/wca-ecommerce.png",
  "wca relocations": "/logos/wca-relocations.png",
  "wca expo": "/logos/wca-expo.png",
  "elite global logistics": "/logos/elite-global-logistics.png",
  "ifc (infinite connections)": "/logos/ifc-infinite-connection.png",
  "lognet global": "/logos/lognet-global.png",
  "gaa (global affinity alliance)": "/logos/gaa-global-affinity.png",
};

function getNetworkLogo(name: string): string | null {
  const key = name.toLowerCase().trim();
  if (NETWORK_LOGOS[key]) return NETWORK_LOGOS[key];
  for (const [k, v] of Object.entries(NETWORK_LOGOS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

interface NetworkPerformanceBarProps {
  stats: Record<string, NetworkStats>;
  excludedNetworks: Set<string>;
  onExclude: (network: string) => void;
  onReinclude: (network: string) => void;
}

export function NetworkPerformanceBar({ stats, excludedNetworks }: NetworkPerformanceBarProps) {
  const entries = Object.entries(stats)
    .filter(([, s]) => s.success + s.empty > 0)
    .sort((a, b) => {
      const rateA = a[1].success / (a[1].success + a[1].empty);
      const rateB = b[1].success / (b[1].success + b[1].empty);
      return rateB - rateA;
    });

  if (entries.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {entries.map(([name, s]) => {
        const total = s.success + s.empty;
        const rate = total > 0 ? Math.round((s.success / total) * 100) : 0;
        const isExcluded = excludedNetworks.has(name);
        const logo = getNetworkLogo(name);

        const borderColor = isExcluded
          ? "border-muted opacity-40 grayscale"
          : rate > 50
            ? "border-emerald-500/60"
            : rate >= 10
              ? "border-amber-500/60"
              : "border-destructive/60";

        return (
          <Tooltip key={name} delayDuration={200}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "relative w-7 h-7 rounded-md border-2 flex items-center justify-center overflow-hidden bg-card/80 transition-all",
                  borderColor
                )}
              >
                {logo ? (
                  <img src={logo} alt={name} className="w-5 h-5 object-contain" />
                ) : (
                  <span className="text-[8px] font-bold text-muted-foreground leading-none text-center">
                    {name.slice(0, 3).toUpperCase()}
                  </span>
                )}
                {isExcluded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <Ban className="w-3.5 h-3.5 text-destructive" />
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p className="font-semibold">{name}</p>
              <p>{s.success}/{total} con contatti ({rate}%)</p>
              {isExcluded && <p className="text-destructive">Auto-escluso</p>}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

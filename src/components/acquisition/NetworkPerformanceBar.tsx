import { Ban, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

export interface NetworkStats {
  success: number;
  empty: number;
}

export interface NetworkRegression {
  network: string;
  previousSuccesses: number;
  consecutiveFailures: number;
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

const FAILED_THRESHOLD = 3;

interface NetworkPerformanceBarProps {
  stats: Record<string, NetworkStats>;
  excludedNetworks: Set<string>;
  onExclude: (network: string) => void;
  onReinclude: (network: string) => void;
  regressions?: NetworkRegression[];
}

function NetworkIcon({ name, s, isExcluded, isFailed }: {
  name: string;
  s: NetworkStats;
  isExcluded: boolean;
  isFailed: boolean;
}) {
  const total = s.success + s.empty;
  const rate = total > 0 ? Math.round((s.success / total) * 100) : 0;
  const logo = getNetworkLogo(name);

  const borderColor = isExcluded
    ? "border-muted opacity-40 grayscale"
    : isFailed
      ? "border-destructive/80"
      : rate > 50
        ? "border-emerald-500/60"
        : rate >= 10
          ? "border-amber-500/60"
          : "border-muted-foreground/30";

  return (
    <Tooltip delayDuration={200}>
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
        {isFailed && !isExcluded && <p className="text-destructive">0% successo</p>}
      </TooltipContent>
    </Tooltip>
  );
}

export function NetworkPerformanceBar({ stats, excludedNetworks, regressions }: NetworkPerformanceBarProps) {
  const entries = Object.entries(stats).filter(([, s]) => s.success + s.empty > 0);

  if (entries.length === 0) return null;

  // Split into active (have successes OR not enough data yet) and failed (0% after threshold)
  const activeEntries = entries
    .filter(([name, s]) => {
      const total = s.success + s.empty;
      return s.success > 0 || total < FAILED_THRESHOLD || excludedNetworks.has(name) === false && s.success > 0;
    })
    .filter(([, s]) => s.success > 0 || (s.success + s.empty) < FAILED_THRESHOLD)
    .sort((a, b) => {
      const rA = a[1].success / (a[1].success + a[1].empty);
      const rB = b[1].success / (b[1].success + b[1].empty);
      return rB - rA;
    });

  const failedEntries = entries
    .filter(([, s]) => s.success === 0 && (s.success + s.empty) >= FAILED_THRESHOLD)
    .sort((a, b) => (b[1].empty) - (a[1].empty));

  const activeCount = activeEntries.length;
  const failedCount = failedEntries.length;

  return (
    <div className="flex items-center gap-1.5">
      {/* Active networks */}
      {activeEntries.map(([name, s]) => (
        <NetworkIcon
          key={name}
          name={name}
          s={s}
          isExcluded={excludedNetworks.has(name)}
          isFailed={false}
        />
      ))}

      {/* Separator between active and failed */}
      {activeEntries.length > 0 && failedEntries.length > 0 && (
        <Separator orientation="vertical" className="h-5 mx-0.5 bg-destructive/30" />
      )}

      {/* Failed networks */}
      {failedEntries.map(([name, s]) => (
        <NetworkIcon
          key={name}
          name={name}
          s={s}
          isExcluded={excludedNetworks.has(name)}
          isFailed={true}
        />
      ))}

      {/* Counters */}
      {(activeCount > 0 || failedCount > 0) && (
        <span className="text-[10px] text-muted-foreground ml-1 whitespace-nowrap">
          {activeCount > 0 && <span className="text-emerald-500">{activeCount} attivi</span>}
          {activeCount > 0 && failedCount > 0 && <span> | </span>}
          {failedCount > 0 && <span className="text-destructive">{failedCount} senza dati</span>}
        </span>
      )}

      {/* Regression alert */}
      {regressions && regressions.length > 0 && (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
             <div className="flex items-center gap-0.5 ml-1 text-primary animate-pulse">
               <AlertTriangle className="w-4 h-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-64">
            <p className="font-semibold text-primary">⚠️ Regressione rilevata</p>
            {regressions.map((r) => (
              <p key={r.network}>
                {r.network}: aveva {r.previousSuccesses} successi, ora {r.consecutiveFailures} fallimenti consecutivi
              </p>
            ))}
            <p className="text-muted-foreground mt-1">Possibile problema di sessione o bug</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

/**
 * CountryGridV2 — Colored grid of countries by partner density
 */
import * as React from "react";
import { useMemo } from "react";
import { getCountryFlag } from "@/lib/countries";
import type { CountryStat } from "@/v2/hooks/useCountryStatsV2";
import { cn } from "@/lib/utils";

interface CountryGridV2Props {
  readonly stats: readonly CountryStat[];
  readonly selectedCountry: string | undefined;
  readonly onSelectCountry: (code: string | undefined) => void;
}

function getDensityClass(count: number, maxCount: number): string {
  const ratio = maxCount > 0 ? count / maxCount : 0;
  if (ratio >= 0.7) return "bg-primary/30 text-primary border-primary/40";
  if (ratio >= 0.4) return "bg-primary/15 text-primary/80 border-primary/25";
  if (ratio >= 0.15) return "bg-primary/8 text-foreground/70 border-primary/15";
  return "bg-muted/40 text-muted-foreground border-border/50";
}

export function CountryGridV2({ stats, selectedCountry, onSelectCountry }: CountryGridV2Props): React.ReactElement {
  const maxCount = useMemo(() => Math.max(...stats.map((s) => s.count), 1), [stats]);

  const handleClick = (code: string) => {
    onSelectCountry(selectedCountry === code ? undefined : code);
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase">
          {stats.length} paesi · {stats.reduce((s, c) => s + c.count, 0).toLocaleString("it-IT")} partner
        </p>
        {selectedCountry && (
          <button
            onClick={() => onSelectCountry(undefined)}
            className="text-[10px] text-primary hover:underline"
          >
            Rimuovi filtro
          </button>
        )}
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1">
        {stats.map((s) => (
          <button
            key={s.country_code}
            onClick={() => handleClick(s.country_code)}
            title={`${s.country_code}: ${s.count} partner`}
            className={cn(
              "flex flex-col items-center justify-center rounded border p-1 text-[10px] transition-all hover:scale-105",
              getDensityClass(s.count, maxCount),
              selectedCountry === s.country_code && "ring-2 ring-primary ring-offset-1 ring-offset-background scale-110",
            )}
          >
            <span className="text-sm leading-none">{getCountryFlag(s.country_code)}</span>
            <span className="font-mono font-semibold">{s.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

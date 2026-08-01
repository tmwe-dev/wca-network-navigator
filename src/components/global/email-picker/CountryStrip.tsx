/**
 * CountryStrip — Vertical country selector strip
 */
import { ArrowUpDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CountryStat, PickerAction, CountrySort } from "./types";

interface CountryStripProps {
  readonly sortedCountries: readonly CountryStat[];
  readonly selectedCountry: string | null;
  readonly countrySort: CountrySort;
  readonly dispatch: React.Dispatch<PickerAction>;
}

export function CountryStrip({ sortedCountries, selectedCountry, countrySort, dispatch }: CountryStripProps) {
  return (
    <div className="flex-shrink-0 w-[80px] flex flex-col min-h-0">
      <div className="flex items-center justify-center mb-1">
        <button
          onClick={() => dispatch({ type: "TOGGLE_COUNTRY_SORT" })}
          className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-foreground"
          title={countrySort === "count" ? "Ordina per nome" : "Ordina per numero"}
        >
          <ArrowUpDown className="w-3 h-3" />
          {countrySort === "count" ? "N°" : "AZ"}
        </button>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-1 pr-1">
          {selectedCountry && (
            <button
              onClick={() => dispatch({ type: "SET_SELECTED_COUNTRY", code: null })}
              className="flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-lg text-[9px] font-medium border border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10"
            >
              <span className="text-base">✕</span>
              <span>Tutti</span>
            </button>
          )}
          {sortedCountries.map(c => (
            <button
              key={c.code}
              onClick={() => dispatch({ type: "SET_SELECTED_COUNTRY", code: selectedCountry === c.code ? null : c.code })}
              className={cn(
                "flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-lg text-[9px] font-medium transition-all border",
                selectedCountry === c.code
                  ? "bg-primary/15 border-primary/40 text-primary ring-1 ring-primary/20"
                  : "border-border/30 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              <span className="text-2xl leading-none">{c.flag}</span>
              <span className="tabular-nums font-bold text-[11px]">{c.count}</span>
              <span className="truncate w-full text-center text-[9px] leading-tight">{c.name}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

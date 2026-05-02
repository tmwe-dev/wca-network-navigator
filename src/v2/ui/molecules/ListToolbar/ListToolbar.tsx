/**
 * ListToolbar — toolbar unificata per le liste WCA / CRM / BCA.
 *
 *  ┌──────────────────────────────────────────────────────────────────────┐
 *  │ ☑ Tutti (50/12k)   🔎 [search…]                          ⋯ azioni   │
 *  │ Ordina:  ◉ Nome ▲   Città   Anni WCA   Score   Stato               │
 *  │ [chips filtri attivi…]                                               │
 *  └──────────────────────────────────────────────────────────────────────┘
 *
 * Logic-less: tutto lo stato (sort, search, chips) arriva via props.
 */
import * as React from "react";
import { ArrowDownAZ, ArrowUpAZ, ArrowUpDown, Search, X, Plane, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ActiveFiltersBar, type ActiveFilterChip } from "@/v2/ui/molecules/ActiveFiltersBar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/** Stato del filtro Holding Pattern (✈️). 'exclude' è il default. */
export type HoldingFilterMode = "exclude" | "include" | "only";

const HOLDING_LABEL: Record<HoldingFilterMode, string> = {
  exclude: "Senza circuito di attesa",
  include: "Tutti (inclusi attesa)",
  only:    "Solo circuito di attesa",
};

const HOLDING_TONE: Record<HoldingFilterMode, string> = {
  exclude: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  include: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  only:    "bg-sky-500/15 text-sky-400 border-sky-500/40",
};

export interface SortOption<K extends string = string> {
  key: K;
  label: string;
}

export interface ListToolbarProps<K extends string = string> {
  /** Conteggio risultati visibili / totali. */
  countLabel?: React.ReactNode;

  /** Stato sort. */
  sortKey: K;
  sortDir: "asc" | "desc";
  sortOptions: ReadonlyArray<SortOption<K>>;
  onCycleSort: (key: K) => void;
  /** Cambio diretto della direzione sort (A↑/Z↓). Se assente usa onCycleSort(sortKey). */
  onToggleSortDir?: () => void;
  /** Cambio diretto della chiave sort (selezione da dropdown). Se assente usa onCycleSort(key). */
  onSelectSortKey?: (key: K) => void;

  /** Stato ricerca locale (controlled). */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  /** Chips filtri attivi (opzionale). */
  chips?: ActiveFilterChip[];

  /** Slot a destra per azioni custom (es. "Sincronizza", "Esporta"). */
  rightSlot?: React.ReactNode;

  /** Stato filtro Holding Pattern. Sempre visibile in toolbar quando definito. */
  holdingFilter?: HoldingFilterMode;
  onHoldingFilterChange?: (mode: HoldingFilterMode) => void;

  className?: string;
}

export function ListToolbar<K extends string = string>({
  countLabel,
  sortKey,
  sortDir,
  sortOptions,
  onCycleSort,
  onToggleSortDir,
  onSelectSortKey,
  search = "",
  onSearchChange,
  searchPlaceholder = "Cerca…",
  chips,
  rightSlot,
  holdingFilter,
  onHoldingFilterChange,
  className,
}: ListToolbarProps<K>): React.ReactElement {
  const currentSortLabel =
    sortOptions.find((o) => o.key === sortKey)?.label ?? "Ordina";

  const handleSortKeyChange = (key: K) => {
    if (onSelectSortKey) onSelectSortKey(key);
    else if (key !== sortKey) onCycleSort(key); // cycle change-key resets dir to asc
  };

  const handleDirToggle = () => {
    if (onToggleSortDir) onToggleSortDir();
    else onCycleSort(sortKey); // stessa key → inverte dir
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 px-3 py-2 border-b border-border/40 bg-muted/10",
        className
      )}
    >
      {/* Riga 1: count + holding badge + search + sort + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {countLabel && (
          <span className="text-[11px] text-muted-foreground font-medium">
            {countLabel}
          </span>
        )}

        {holdingFilter && onHoldingFilterChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "h-6 px-2 rounded-full text-[10px] font-semibold border inline-flex items-center gap-1 transition-all",
                  HOLDING_TONE[holdingFilter]
                )}
                title="Filtro circuito di attesa"
              >
                <Plane className="w-3 h-3" />
                {HOLDING_LABEL[holdingFilter]}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="z-[80]">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Circuito di attesa
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(["exclude", "include", "only"] as HoldingFilterMode[]).map((m) => (
                <DropdownMenuItem
                  key={m}
                  onClick={() => onHoldingFilterChange(m)}
                  className="text-xs flex items-center gap-2"
                >
                  <span className="w-3 inline-flex justify-center">
                    {holdingFilter === m && <Check className="w-3 h-3 text-primary" />}
                  </span>
                  {HOLDING_LABEL[m]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="relative flex-1 min-w-[180px] max-w-[320px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-7 pl-7 pr-7 text-xs bg-card/50"
          />
          {search && onSearchChange && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted/40 rounded"
              aria-label="Pulisci ricerca"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {/* Sort: dropdown chiave + bottone direzione */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-7 px-2 rounded-md text-[11px] font-medium border inline-flex items-center gap-1 bg-card/40 text-muted-foreground border-border/40 hover:text-foreground hover:border-border transition-all"
                title="Ordina per…"
              >
                <ArrowUpDown className="w-3 h-3" />
                <span className="hidden sm:inline">Ordina:</span>
                <span className="text-foreground font-semibold">{currentSortLabel}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[80] min-w-[160px]">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Ordina per
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sortOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.key}
                  onClick={() => handleSortKeyChange(opt.key)}
                  className="text-xs flex items-center gap-2"
                >
                  <span className="w-3 inline-flex justify-center">
                    {opt.key === sortKey && <Check className="w-3 h-3 text-primary" />}
                  </span>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={handleDirToggle}
            className="h-7 w-7 rounded-md border bg-card/40 text-muted-foreground border-border/40 hover:text-foreground hover:border-border transition-all inline-flex items-center justify-center"
            title={sortDir === "asc" ? "Ordine crescente (A→Z) — clicca per invertire" : "Ordine decrescente (Z→A) — clicca per invertire"}
            aria-label="Inverti direzione ordinamento"
          >
            {sortDir === "asc" ? (
              <ArrowUpAZ className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownAZ className="w-3.5 h-3.5" />
            )}
          </button>

          {rightSlot}
        </div>
      </div>

      {/* Riga 2: chips filtri attivi */}
      {chips && chips.length > 0 && (
        <ActiveFiltersBar chips={chips} className="px-0 -mx-1 border-b-0 bg-transparent" />
      )}
    </div>
  );
}

export default ListToolbar;
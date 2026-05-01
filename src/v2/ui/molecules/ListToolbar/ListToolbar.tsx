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
import { ArrowDown, ArrowUp, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ActiveFiltersBar, type ActiveFilterChip } from "@/v2/ui/molecules/ActiveFiltersBar";

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

  /** Stato ricerca locale (controlled). */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  /** Chips filtri attivi (opzionale). */
  chips?: ActiveFilterChip[];

  /** Slot a destra per azioni custom (es. "Sincronizza", "Esporta"). */
  rightSlot?: React.ReactNode;

  className?: string;
}

export function ListToolbar<K extends string = string>({
  countLabel,
  sortKey,
  sortDir,
  sortOptions,
  onCycleSort,
  search = "",
  onSearchChange,
  searchPlaceholder = "Cerca…",
  chips,
  rightSlot,
  className,
}: ListToolbarProps<K>): React.ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 px-3 py-2 border-b border-border/40 bg-muted/10",
        className
      )}
    >
      {/* Riga 1: count + search + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {countLabel && (
          <span className="text-[11px] text-muted-foreground font-medium">
            {countLabel}
          </span>
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
        <div className="ml-auto flex items-center gap-1">{rightSlot}</div>
      </div>

      {/* Riga 2: pillole sort */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide font-semibold mr-1">
          Ordina
        </span>
        {sortOptions.map((opt) => {
          const active = opt.key === sortKey;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onCycleSort(opt.key)}
              className={cn(
                "h-6 px-2 rounded-full text-[10px] font-medium transition-all flex items-center gap-1 border",
                active
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "bg-card/40 text-muted-foreground border-border/40 hover:border-border hover:text-foreground"
              )}
            >
              {opt.label}
              {active &&
                (sortDir === "asc" ? (
                  <ArrowUp className="w-2.5 h-2.5" />
                ) : (
                  <ArrowDown className="w-2.5 h-2.5" />
                ))}
            </button>
          );
        })}
      </div>

      {/* Riga 3: chips filtri attivi */}
      {chips && chips.length > 0 && (
        <ActiveFiltersBar chips={chips} className="px-0 -mx-1 border-b-0 bg-transparent" />
      )}
    </div>
  );
}

export default ListToolbar;
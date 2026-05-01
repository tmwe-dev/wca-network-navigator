/**
 * UnifiedListToolbar — single-row toolbar for list pages (CRM, Partner,
 * Biglietti). Shows: total counter • active-filter chips • sort menu • actions.
 *
 * Design: all filters live in the left FiltersDrawer; this toolbar only
 * surfaces what is currently filtered (as removable chips) and exposes
 * sorting + page-specific actions.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowUpDown, ArrowUp, ArrowDown, X, Filter as FilterIcon, Check } from "lucide-react";
import type { FilterChip, ChipTone } from "./useActiveFilterChips";

export interface SortOption {
  readonly value: string;
  readonly label: string;
}

interface Props {
  /** Left-most counter, e.g. "11.349 contatti". */
  counter: React.ReactNode;
  /** Currently active filter chips (rendered after counter). */
  chips: readonly FilterChip[];
  /** Optional click handler on counter → opens FiltersDrawer. */
  onOpenFilters?: () => void;
  /** Sort menu config (omit to hide). */
  sort?: {
    options: readonly SortOption[];
    value: string;
    direction: "asc" | "desc";
    onChange: (value: string) => void;
    onToggleDirection: () => void;
  };
  /** Right-side actions slot (e.g. "+ Nuovo", "Sincronizza"). */
  actions?: React.ReactNode;
  className?: string;
}

const TONE_CLS: Record<ChipTone, string> = {
  neutral: "bg-muted/60 text-foreground/80 border-border/40",
  primary: "bg-primary/15 text-primary border-primary/25",
  "circuit-out": "bg-sky-500/15 text-sky-400 border-sky-500/25",
  "circuit-in": "bg-destructive/15 text-destructive border-destructive/25",
  danger: "bg-destructive/15 text-destructive border-destructive/25",
};

export function UnifiedListToolbar({
  counter, chips, onOpenFilters, sort, actions, className,
}: Props): React.ReactElement {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 border-b border-border/30 shrink-0 min-h-[36px]",
        className,
      )}
      data-testid="unified-list-toolbar"
    >
      {/* Counter (clickable → opens drawer) */}
      <button
        type="button"
        onClick={onOpenFilters}
        className={cn(
          "text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 shrink-0",
          onOpenFilters && "cursor-pointer",
        )}
        title={onOpenFilters ? "Apri filtri" : undefined}
      >
        {onOpenFilters && <FilterIcon className="w-3 h-3 opacity-60" />}
        {counter}
      </button>

      {/* Chips */}
      <div className="flex items-center gap-1 flex-wrap min-w-0 flex-1">
        {chips.length === 0 ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/50 text-muted-foreground border border-border/30">
            Tutti
          </span>
        ) : (
          chips.map((c) => {
            const Icon = c.icon;
            return (
              <span
                key={c.key}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap",
                  TONE_CLS[c.tone],
                )}
              >
                {Icon && <Icon className={cn("w-2.5 h-2.5", c.tone === "circuit-in" && "animate-pulse")} />}
                <span className="truncate max-w-[140px]">{c.label}</span>
                {c.onRemove && (
                  <button
                    type="button"
                    onClick={c.onRemove}
                    className="ml-0.5 p-0.5 rounded-full hover:bg-foreground/10 transition-colors"
                    aria-label={`Rimuovi filtro ${c.label}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </span>
            );
          })
        )}
      </div>

      {/* Sort */}
      {sort && <SortMenu sort={sort} />}

      {/* Actions */}
      {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
    </div>
  );
}

function SortMenu({ sort }: { sort: NonNullable<Props["sort"]> }) {
  const current = sort.options.find((o) => o.value === sort.value);
  const DirIcon = sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] gap-1 shrink-0">
          <ArrowUpDown className="w-3 h-3 opacity-60" />
          <span>{current?.label ?? "Ordina"}</span>
          <DirIcon className="w-3 h-3 text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        <div className="text-[9px] uppercase tracking-wide text-muted-foreground px-2 py-1">Ordina per</div>
        {sort.options.map((o) => {
          const active = o.value === sort.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => sort.onChange(o.value)}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-muted/60 transition-colors",
                active && "text-primary font-medium",
              )}
            >
              <span>{o.label}</span>
              {active && <Check className="w-3 h-3" />}
            </button>
          );
        })}
        <div className="border-t border-border/40 my-1" />
        <button
          type="button"
          onClick={sort.onToggleDirection}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-muted/60 transition-colors"
        >
          <DirIcon className="w-3 h-3" />
          <span>{sort.direction === "asc" ? "Crescente" : "Decrescente"}</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * ActiveFiltersBar — Barra display-only dei filtri attualmente attivi.
 *
 * Mostra come badge i filtri selezionati nella sidebar (paese, origine,
 * holding pattern, qualità, ecc.) così l'utente vede sempre cosa sta
 * filtrando senza riaprire il pannello.
 *
 * Display-only: non rimuove i filtri (richiesta esplicita utente).
 * Per modificare, l'utente apre la sidebar.
 */
import * as React from "react";
import { Filter, Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ActiveFilterChip {
  /** Chiave univoca (es. "country:CN", "holding:in"). */
  key: string;
  /** Etichetta visibile (es. "Cina", "In Holding"). */
  label: string;
  /** Tono visivo opzionale. */
  tone?: "default" | "primary" | "warning";
  /** Icona inline opzionale (es. ✈️ per holding). */
  icon?: "holding" | null;
}

export interface ActiveFiltersBarProps {
  chips: ActiveFilterChip[];
  /** Etichetta a sinistra. Default: "Filtri attivi". */
  label?: string;
  className?: string;
}

export function ActiveFiltersBar({
  chips,
  label = "Filtri attivi",
  className,
}: ActiveFiltersBarProps): React.ReactElement | null {
  if (!chips.length) return null;
  return (
    <div
      data-testid="active-filters-bar"
      className={cn(
        "flex items-center gap-2 flex-wrap px-4 py-1.5 border-b border-border/30 bg-muted/20",
        className
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 font-medium">
        <Filter className="w-3 h-3" />
        <span>{label}:</span>
      </div>
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="outline"
          className={cn(
            "text-[10px] py-0 px-1.5 h-5 flex items-center gap-1",
            chip.tone === "primary" &&
              "bg-primary/10 text-primary border-primary/30",
            chip.tone === "warning" &&
              "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400",
            (!chip.tone || chip.tone === "default") &&
              "bg-card/60 text-foreground/80 border-border/50"
          )}
        >
          {chip.icon === "holding" && <Plane className="w-2.5 h-2.5" />}
          {chip.label}
        </Badge>
      ))}
    </div>
  );
}

export default ActiveFiltersBar;
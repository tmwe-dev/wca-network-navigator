/**
 * FilterToolbar — wrapper canonico per le toolbar pagina.
 *
 * Sostituisce le 32+ varianti di sfondo toolbar (bg-card/40, bg-card/60,
 * bg-muted/20, bg-muted/30...) con un'unica classe coerente.
 *
 * Uso:
 *   <FilterToolbar>
 *     <Input ... />
 *     <Select ... />
 *     <Button ... />
 *   </FilterToolbar>
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { UI_TOKENS } from "@/v2/ui/tokens";

interface FilterToolbarProps {
  readonly children: React.ReactNode;
  /** Versione compatta (padding/gap ridotti). Default false. */
  readonly compact?: boolean;
  /** Override puntuale (es. ordine, allineamento). Non usare per cambiare colori. */
  readonly className?: string;
}

export function FilterToolbar({
  children,
  compact = false,
  className,
}: FilterToolbarProps): React.ReactElement {
  return (
    <div className={cn(compact ? UI_TOKENS.TOOLBAR_COMPACT : UI_TOKENS.TOOLBAR, className)}>
      {children}
    </div>
  );
}
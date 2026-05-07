/**
 * SurfaceCard — wrapper canonico per le card pagina.
 *
 * Tre varianti coprono il 90% dei casi:
 * - "surface"     → card primaria con bordo
 * - "subtle"      → card secondaria, sfondo tenue, no bordo
 * - "interactive" → come surface + hover/cursor
 *
 * Per esigenze più complesse usare il componente shadcn Card.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { UI_TOKENS } from "@/v2/ui/tokens";

type SurfaceVariant = "surface" | "subtle" | "interactive";

/**
 * Padding override. `default` mantiene il padding del token (p-4 / p-3).
 * `none` rimuove il padding — utile quando la card contiene un header
 * proprio o una tabella che gestisce internamente i propri spazi.
 */
type SurfacePadding = "default" | "none";

/** Solo le parti non-padding del token, per la variante padding="none". */
const VARIANT_BASE: Record<SurfaceVariant, string> = {
  surface: "rounded-lg border border-border/60 bg-card",
  subtle: "rounded-md bg-muted/20",
  interactive:
    "rounded-lg border border-border/60 bg-card hover:border-primary/30 transition-colors cursor-pointer",
};

const VARIANT_FULL: Record<SurfaceVariant, string> = {
  surface: UI_TOKENS.CARD_SURFACE,
  subtle: UI_TOKENS.CARD_SUBTLE,
  interactive: UI_TOKENS.CARD_INTERACTIVE,
};

interface SurfaceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly variant?: SurfaceVariant;
  readonly padding?: SurfacePadding;
  readonly children: React.ReactNode;
  readonly className?: string;
}

export function SurfaceCard({
  variant = "surface",
  padding = "default",
  children,
  className,
  ...rest
}: SurfaceCardProps): React.ReactElement {
  const base = padding === "none" ? VARIANT_BASE[variant] : VARIANT_FULL[variant];
  return (
    <div className={cn(base, className)} {...rest}>
      {children}
    </div>
  );
}
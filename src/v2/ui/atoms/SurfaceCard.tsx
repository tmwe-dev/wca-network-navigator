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

const VARIANT_CLASS: Record<SurfaceVariant, string> = {
  surface: UI_TOKENS.CARD_SURFACE,
  subtle: UI_TOKENS.CARD_SUBTLE,
  interactive: UI_TOKENS.CARD_INTERACTIVE,
};

interface SurfaceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly variant?: SurfaceVariant;
  readonly children: React.ReactNode;
  readonly className?: string;
}

export function SurfaceCard({
  variant = "surface",
  children,
  className,
  ...rest
}: SurfaceCardProps): React.ReactElement {
  return (
    <div className={cn(VARIANT_CLASS[variant], className)} {...rest}>
      {children}
    </div>
  );
}
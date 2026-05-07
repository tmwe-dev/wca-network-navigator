/**
 * EmptyState atom — Design System v2 (STEP 5 armonizzato).
 *
 * Pattern visivo allineato a `components/shared/EmptyState` e
 * `components/ui/empty-state`: icona in tile rounded su `bg-muted/40`,
 * tipografia coerente (`text-sm` titolo / `text-xs` descrizione), CTA opzionale.
 * API invariata: accetta `icon` come ReactNode (no breaking change).
 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  readonly icon?: React.ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly action?: React.ReactNode;
  readonly className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): React.ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 px-6 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center text-muted-foreground/60">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="text-xs text-muted-foreground max-w-[320px] leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

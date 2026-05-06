/**
 * PageShell — Wrapper coerente per le pagine V2.
 *
 * Fornisce container, padding responsive, gerarchia titolo/descrizione/azioni
 * uniforme. È puramente presentazionale: nessuna logica, nessun fetch.
 * Le pagine possono adottarlo gradualmente senza rompere quelle esistenti.
 *
 * Uso:
 *   <PageShell
 *     title="Inbox"
 *     description="Le email in arrivo classificate dall'AI"
 *     actions={<Button>Nuova email</Button>}
 *     toolbar={<FiltersBar />}
 *   >
 *     <Section>...</Section>
 *   </PageShell>
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageShellProps {
  readonly title?: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly actions?: React.ReactNode;
  readonly toolbar?: React.ReactNode;
  readonly children: React.ReactNode;
  /** Width: "narrow" 720, "default" 1280, "wide" 1536, "full" 100%. */
  readonly width?: "narrow" | "default" | "wide" | "full";
  /** Disabilita il padding di default (per pagine full-bleed). */
  readonly bleed?: boolean;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly testId?: string;
}

const widthMap: Record<NonNullable<PageShellProps["width"]>, string> = {
  narrow: "max-w-3xl",
  default: "max-w-7xl",
  wide: "max-w-screen-2xl",
  full: "max-w-none",
};

export function PageShell({
  title,
  description,
  actions,
  toolbar,
  children,
  width = "default",
  bleed = false,
  className,
  contentClassName,
  testId,
}: PageShellProps): React.ReactElement {
  return (
    <div
      data-testid={testId}
      className={cn(
        "min-h-full w-full bg-background text-foreground",
        !bleed && "px-4 py-5 sm:px-6 lg:px-8",
        className,
      )}
    >
      <div className={cn("mx-auto w-full space-y-5", widthMap[width])}>
        {(title || description || actions) && (
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              {title && (
                <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {title}
                </h1>
              )}
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            {actions && (
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                {actions}
              </div>
            )}
          </header>
        )}

        {toolbar && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 backdrop-blur-sm">
            {toolbar}
          </div>
        )}

        <div className={cn("space-y-5", contentClassName)}>{children}</div>
      </div>
    </div>
  );
}

/** Section — blocco logico interno alla pagina. */
export interface SectionProps {
  readonly title?: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly actions?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string;
}

export function Section({ title, description, actions, children, className }: SectionProps): React.ReactElement {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || description || actions) && (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export default PageShell;
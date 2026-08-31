/**
 * StandardPageFrame — Guscio UNIFORME per ogni maschera V2.
 *
 * Ristrutturazione UX 2026-06. Garantisce a OGNI pagina la stessa struttura:
 *   - Header in-mask: breadcrumb/titolo a sinistra, pulsante ✦ AI sempre
 *     presente a destra, seguito dalle azioni specifiche della pagina.
 *   - Tabs di sezione opzionali con stile unico ("pill").
 *   - Area contenuto.
 *
 * I rail laterali (filtri a SINISTRA, workflow a DESTRA) restano gestiti
 * globalmente da AuthenticatedLayout in base a `pageContract.ts`: questo
 * guscio NON li monta, così non si creano doppioni.
 *
 * È puramente presentazionale: nessuna logica, nessun fetch. Adozione
 * graduale, pagina per pagina, senza rompere quelle esistenti.
 */
import * as React from "react";
import { useLocation, Link } from "react-router-dom";
import { Sparkles, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildCrumbs } from "./breadcrumbConfig";
import { SectionTabs, type SectionTab } from "./SectionTabs";

/** Apre il Floating Co-Pilot già attivo sul contesto pagina. */
export function openCoPilot(): void {
  window.dispatchEvent(new CustomEvent("copilot-open"));
}

/** Apre il Co-Pilot e avvia direttamente la conversazione vocale. */
export function openCoPilotVoice(): void {
  window.dispatchEvent(new CustomEvent("copilot-voice"));
}


export interface StandardPageFrameProps {
  /** Override del titolo (altrimenti deriva dal breadcrumb). */
  readonly title?: React.ReactNode;
  /** Nasconde il breadcrumb (rari casi full-screen). */
  readonly hideBreadcrumb?: boolean;
  /** Etichetta finale del breadcrumb (es. entità selezionata). */
  readonly trailingLabel?: string | null;
  /** Azioni specifiche della pagina (a destra, dopo il pulsante AI). */
  readonly actions?: React.ReactNode;
  /** Nasconde il pulsante AI (sconsigliato: deve essere sempre raggiungibile). */
  readonly hideAi?: boolean;
  /** Tabs di sezione (stile unico). */
  readonly tabs?: readonly SectionTab[];
  /** Root path della sezione per la detection del tab di default. */
  readonly tabsRootPath?: string;
  /** Comportamento overflow dell'area contenuto. */
  readonly contentOverflow?: "auto" | "contain";
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly testId?: string;
}

export function StandardPageFrame({
  title,
  hideBreadcrumb,
  trailingLabel,
  actions,
  hideAi,
  tabs,
  tabsRootPath,
  contentOverflow = "auto",
  children,
  className,
  testId,
}: StandardPageFrameProps): React.ReactElement {
  const { pathname } = useLocation();
  const crumbs = React.useMemo(() => {
    const base = buildCrumbs(pathname).slice();
    if (trailingLabel) base.push({ label: trailingLabel });
    return base;
  }, [pathname, trailingLabel]);

  const body =
    tabs && tabs.length > 0 ? (
      <SectionTabs tabs={tabs} rootPath={tabsRootPath ?? pathname} variant="pill" contentOverflow={contentOverflow}>
        {children}
      </SectionTabs>
    ) : (
      <div className={cn("flex-1 min-h-0", contentOverflow === "contain" ? "overflow-hidden" : "overflow-y-auto")}>
        {children}
      </div>
    );

  return (
    <div
      data-testid={testId ?? "standard-page-frame"}
      className={cn("flex flex-col h-full overflow-hidden", className)}
    >
      {/* Header in-mask uniforme */}
      <div className="h-9 flex items-center justify-between gap-3 px-4 border-b border-border/40 bg-card/40 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {title ? (
            <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
          ) : !hideBreadcrumb ? (
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs min-w-0 overflow-hidden">
              {crumbs.map((c, i) => (
                <React.Fragment key={`${c.label}-${i}`}>
                  {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                  {c.href ? (
                    <Link
                      to={c.href}
                      className="text-muted-foreground hover:text-foreground transition-colors truncate"
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground truncate">{c.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!hideAi && (
            <>
              <button
                type="button"
                onClick={openCoPilotVoice}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                aria-label="Parla con l'assistente vocale"
                title="Assistente vocale"
              >
                <Mic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={openCoPilot}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 text-[11px] font-semibold text-primary hover:bg-primary/15 hover:border-primary transition-colors"
                aria-label="Apri assistente AI"
              >
                <Sparkles className="h-3.5 w-3.5" /> AI
              </button>
            </>
          )}

          {actions}
        </div>
      </div>

      {body}
    </div>
  );
}

export default StandardPageFrame;

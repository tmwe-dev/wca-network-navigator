/**
 * PageFrame — l'unico guscio di pagina della V3.
 *
 * Struttura fissa (docs/v3/contratto-pagina.md):
 *   [ FILTRI (sx) ] [ header di maschera + toolbar + contenuto ] [ WORKFLOW (dx) ]
 *
 * Regole applicate qui, non lasciate alla buona volontà delle pagine:
 * - sinistra = solo filtri, destra = solo workflow;
 * - un rail senza contenuto non si monta (niente pannelli vuoti);
 * - il tasto ✦ AI sta sempre nello stesso punto;
 * - sotto `lg` i due rail diventano drawer, il contenuto resta intero.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { Sparkles, SlidersHorizontal, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { V3_PAGES, type V3PageId } from "./pageContract";

export interface PageFrameProps {
  /** Identificatore dichiarato in `pageContract.ts`. Da lì arrivano titolo, tipo e domanda. */
  readonly pageId: V3PageId;
  /** Percorso di risalita opzionale (solo maschere di dettaglio). */
  readonly parent?: { readonly label: string; readonly to: string };
  /** Titolo alternativo per le maschere di dettaglio (es. il nome del contatto). */
  readonly titleOverride?: string;
  /** Azioni primarie dell'header. Massimo due: il resto va nel rail destro. */
  readonly actions?: React.ReactNode;
  /** Barra contestuale opzionale sotto l'header (ricerca, tab, conteggi). */
  readonly toolbar?: React.ReactNode;
  /** Contenuto del rail sinistro. Solo filtri. */
  readonly filters?: React.ReactNode;
  /** Contenuto del rail destro. Solo azioni e stato operativo. */
  readonly workflow?: React.ReactNode;
  /** Apre l'assistente sul contesto della pagina. Assente = tasto non mostrato. */
  readonly onAskAi?: () => void;
  readonly children: React.ReactNode;
}

function RailHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>
  );
}

export function PageFrame({
  pageId,
  parent,
  titleOverride,
  actions,
  toolbar,
  filters,
  workflow,
  onAskAi,
  children,
}: PageFrameProps) {
  const page = V3_PAGES[pageId];
  const title = titleOverride ?? page.title;
  const hasFilters = Boolean(filters);
  const hasWorkflow = Boolean(workflow);

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* ── Rail filtri (sinistra) ─────────────────────────────── */}
      {hasFilters && (
        <aside className="hidden w-60 shrink-0 border-r border-border bg-muted/30 lg:block">
          <ScrollArea className="h-full">
            <div className="p-3">
              <RailHeading>Filtri</RailHeading>
              <div className="space-y-3">{filters}</div>
            </div>
          </ScrollArea>
        </aside>
      )}

      {/* ── Colonna centrale ───────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
          {hasFilters && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" aria-label="Apri filtri">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b border-border p-3">
                  <SheetTitle className="text-sm">Filtri</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100%-3.25rem)]">
                  <div className="space-y-3 p-3">{filters}</div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          )}

          <div className="flex min-w-0 items-center gap-2">
            {parent && (
              <>
                <Link
                  to={parent.to}
                  className="truncate text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {parent.label}
                </Link>
                <span aria-hidden className="text-xs text-muted-foreground/60">
                  /
                </span>
              </>
            )}
            <h1 className="truncate text-sm font-semibold text-foreground">{title}</h1>
            <span className="hidden truncate text-xs text-muted-foreground xl:inline">— {page.question}</span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {actions}
            {onAskAi && (
              <>
                <Separator orientation="vertical" className="mx-0.5 h-4" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-primary hover:text-primary"
                  onClick={onAskAi}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">AI</span>
                </Button>
              </>
            )}
            {hasWorkflow && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" aria-label="Apri azioni">
                    <PanelRight className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 p-0">
                  <SheetHeader className="border-b border-border p-3">
                    <SheetTitle className="text-sm">Azioni</SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100%-3.25rem)]">
                    <div className="space-y-3 p-3">{workflow}</div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </header>

        {toolbar && (
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-muted/20 px-3">{toolbar}</div>
        )}

        <main
          className={cn(
            "min-h-0 flex-1",
            page.kind === "operational" ? "overflow-hidden" : "overflow-y-auto",
            page.kind === "detail" ? "p-4" : "p-3",
          )}
        >
          {children}
        </main>
      </div>

      {/* ── Rail workflow (destra) ─────────────────────────────── */}
      {hasWorkflow && (
        <aside className="hidden w-60 shrink-0 border-l border-border bg-muted/30 lg:block">
          <ScrollArea className="h-full">
            <div className="p-3">
              <RailHeading>Azioni</RailHeading>
              <div className="space-y-3">{workflow}</div>
            </div>
          </ScrollArea>
        </aside>
      )}
    </div>
  );
}

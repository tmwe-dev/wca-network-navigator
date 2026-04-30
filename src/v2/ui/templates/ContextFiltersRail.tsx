import * as React from "react";
import { useLocation } from "react-router-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NetworkFiltersSection } from "@/components/global/filters-drawer/NetworkFiltersSection";
import { CRMFiltersSection } from "@/components/global/filters-drawer/CRMFiltersSection";
import { BCAFiltersSection } from "@/components/global/filters-drawer/BCAFiltersSection";

function getFilterContext(pathname: string): { title: string; content: React.ReactNode } | null {
  if (pathname.startsWith("/v2/explore/network") || pathname === "/v2/network") {
    return { title: "Filtri WCA Partner", content: <NetworkFiltersSection /> };
  }

  if (pathname.startsWith("/v2/pipeline/contacts") || pathname.startsWith("/v2/pipeline/kanban") || pathname.startsWith("/v2/crm/contacts") || pathname === "/v2/crm" || pathname === "/v2/contacts") {
    return { title: "Filtri Contatti CRM", content: <CRMFiltersSection /> };
  }

  if (pathname.startsWith("/v2/pipeline/biglietti") || pathname.startsWith("/v2/crm/biglietti") || pathname.startsWith("/v2/crm/business-cards")) {
    return { title: "Filtri Biglietti da visita", content: <BCAFiltersSection /> };
  }

  return null;
}

const STORAGE_KEY = "dl_context_filters_open";

function readInitialOpen(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    // Default chiuso (a scomparsa). L'utente apre con la linguetta.
    return v === "1";
  } catch {
    return false;
  }
}

/**
 * Sidebar filtri contestuale a scomparsa.
 * - Linguetta verticale sempre visibile sul bordo sinistro del contenuto.
 * - Click sulla linguetta apre/chiude un pannello laterale (w-80).
 * - Stato persistito in localStorage.
 * - Nasconde tutto quando la rotta non ha filtri contestuali.
 */
export function ContextFiltersRail(): React.ReactElement | null {
  const { pathname } = useLocation();
  const context = getFilterContext(pathname);
  const [open, setOpen] = React.useState<boolean>(readInitialOpen);

  React.useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, open ? "1" : "0"); } catch { /* noop */ }
  }, [open]);

  // Permette ad altri componenti di aprire/chiudere il rail via evento.
  React.useEffect(() => {
    const onToggle = () => setOpen((v) => !v);
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);
    window.addEventListener("context-filters-toggle", onToggle);
    window.addEventListener("context-filters-open", onOpen);
    window.addEventListener("context-filters-close", onClose);
    return () => {
      window.removeEventListener("context-filters-toggle", onToggle);
      window.removeEventListener("context-filters-open", onOpen);
      window.removeEventListener("context-filters-close", onClose);
    };
  }, []);

  if (!context) return null;

  return (
    <>
      {/* Pannello a scomparsa (desktop md+). Su mobile resta il FiltersDrawer globale. */}
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col border-r border-border/40 bg-card/45 backdrop-blur-sm transition-[width] duration-200 ease-out overflow-hidden",
          open ? "w-80" : "w-0",
        )}
        aria-label={context.title}
        aria-hidden={!open}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border/40 px-4">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-bold uppercase text-foreground flex-1 truncate">{context.title}</h2>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Chiudi filtri"
            title="Chiudi filtri"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4 w-80">
          {context.content}
        </div>
      </aside>

      {/* Linguetta sempre visibile per riaprire il pannello quando chiuso */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="hidden md:flex shrink-0 items-center justify-center w-6 border-r border-border/40 bg-card/30 hover:bg-primary/10 text-primary/80 hover:text-primary transition-colors group"
          aria-label={`Apri ${context.title}`}
          title={context.title}
          data-testid="context-filters-tab"
        >
          <div className="flex flex-col items-center gap-2 py-3">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-primary"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Filtri
            </span>
          </div>
        </button>
      )}
    </>
  );
}

export default ContextFiltersRail;
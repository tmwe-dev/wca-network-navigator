import * as React from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X, Check, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NetworkFiltersSection } from "@/components/global/filters-drawer/NetworkFiltersSection";
import { CRMFiltersSection } from "@/components/global/filters-drawer/CRMFiltersSection";
import { BCAFiltersSection } from "@/components/global/filters-drawer/BCAFiltersSection";

/**
 * Sceglie il pannello filtri in base al pathname e al query param `?origine=`.
 *
 * UX redesign apr 2026: la sezione Contatti unifica WCA / CRM / Biglietti come
 * **origini** della stessa pipeline. I filtri si adattano all'origine corrente.
 */
function getFilterContext(
  pathname: string,
  origine: string | null,
): { title: string; content: React.ReactNode } | null {
  // Pipeline unica /v2/pipeline/* — filtri scelti in base all'origine.
  if (pathname.startsWith("/v2/pipeline")) {
    const o = (origine ?? "crm").toLowerCase();
    if (o === "wca") {
      return { title: "Filtri WCA Partner", content: <NetworkFiltersSection /> };
    }
    if (o === "biglietti") {
      return { title: "Filtri Biglietti da visita", content: <BCAFiltersSection /> };
    }
    return { title: "Filtri Contatti", content: <CRMFiltersSection /> };
  }

  // Legacy paths kept working (in caso qualcuno arrivi via vecchio link prima del redirect).
  if (pathname.startsWith("/v2/explore/network") || pathname === "/v2/network") {
    return { title: "Filtri WCA Partner", content: <NetworkFiltersSection /> };
  }
  if (pathname.startsWith("/v2/crm/biglietti") || pathname.startsWith("/v2/crm/business-cards")) {
    return { title: "Filtri Biglietti da visita", content: <BCAFiltersSection /> };
  }
  if (pathname.startsWith("/v2/crm") || pathname === "/v2/contacts") {
    return { title: "Filtri Contatti", content: <CRMFiltersSection /> };
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
  const [searchParams] = useSearchParams();
  const context = getFilterContext(pathname, searchParams.get("origine"));
  const [open, setOpen] = React.useState<boolean>(readInitialOpen);
  const asideRef = React.useRef<HTMLElement | null>(null);
  const tabRef = React.useRef<HTMLButtonElement | null>(null);

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

  // Click-outside: chiudi quando l'utente clicca fuori dalla sidebar e fuori dalla linguetta.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (asideRef.current?.contains(target)) return;
      if (tabRef.current?.contains(target)) return;
      // Ignora click su popover/dropdown/portaled overlays (Radix usa data-radix-*).
      const el = target as HTMLElement;
      if (el.closest?.("[data-radix-popper-content-wrapper], [role='dialog'], [role='listbox'], [role='menu'], [data-sonner-toaster]")) return;
      setOpen(false);
    };
    // pointerdown intercetta anche prima che il click attivi un bottone della pagina.
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  // ESC: chiudi.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!context) return null;

  return (
    <>
      {/* Pannello a scomparsa (desktop md+). Su mobile resta il FiltersDrawer globale. */}
      <aside
        ref={asideRef}
        className={cn(
          "hidden md:flex shrink-0 flex-col border-r border-border/40 bg-card/45 backdrop-blur-sm transition-[width] duration-200 ease-out overflow-hidden relative",
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
        {/* Footer con bottone Applica e chiudi: i filtri sono già live, qui confermiamo e chiudiamo. */}
        <div className="shrink-0 border-t border-border/40 bg-card/60 px-3 py-2 w-80 flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOpen(false)}
            className="h-8 text-xs"
            title="Chiudi senza modificare"
          >
            Chiudi
          </Button>
          <Button
            size="sm"
            onClick={() => setOpen(false)}
            className="h-8 text-xs gap-1.5"
            title="Applica e chiudi"
          >
            <Check className="h-3.5 w-3.5" />
            Applica e chiudi
          </Button>
        </div>
      </aside>

      {/* Linguetta sempre visibile: TOGGLE — apre quando chiusa, chiude quando aperta */}
      <button
        ref={tabRef}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "hidden md:flex shrink-0 items-center justify-center w-6 border-r border-border/40 transition-colors group",
          open
            ? "bg-primary/15 text-primary hover:bg-primary/25"
            : "bg-card/30 text-primary/80 hover:bg-primary/10 hover:text-primary",
        )}
        aria-label={open ? `Chiudi ${context.title}` : `Apri ${context.title}`}
        aria-expanded={open}
        title={open ? "Chiudi filtri" : context.title}
        data-testid="context-filters-tab"
      >
        <div className="flex flex-col items-center gap-2 py-3">
          {open ? (
            <ChevronLeft className="h-3.5 w-3.5" />
          ) : (
            <SlidersHorizontal className="h-3.5 w-3.5" />
          )}
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              open ? "text-primary" : "text-muted-foreground group-hover:text-primary",
            )}
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {open ? "Chiudi" : "Filtri"}
          </span>
        </div>
      </button>
    </>
  );
}

export default ContextFiltersRail;
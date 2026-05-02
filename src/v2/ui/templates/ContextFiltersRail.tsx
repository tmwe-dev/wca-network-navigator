import * as React from "react";
import { useLocation } from "react-router-dom";
import { PanelLeftClose, SlidersHorizontal } from "lucide-react";
import { NetworkFiltersSection } from "@/components/global/filters-drawer/NetworkFiltersSection";
import { CRMFiltersSection } from "@/components/global/filters-drawer/CRMFiltersSection";
import { BCAFiltersRailContent } from "@/components/contacts/bca/BCAFiltersRailContent";

function getFilterContext(pathname: string, networkView: "partners" | "bca"): { title: string; content: React.ReactNode } | null {
  if (pathname.startsWith("/v2/explore/network") || pathname === "/v2/network" || pathname.startsWith("/v2/partner-hub")) {
    // Network › BCA: la sidebar interna è stata rimossa, qui ospitiamo
    // direttamente paesi + filtri qualità + ordinamento + selettore vista.
    if (networkView === "bca") {
      return { title: "Filtri Biglietti BCA", content: <BCAFiltersRailContent /> };
    }
    return { title: "Filtri WCA Partner", content: <NetworkFiltersSection /> };
  }

  if (
    pathname.startsWith("/v2/pipeline/contacts") ||
    pathname.startsWith("/v2/pipeline/kanban") ||
    pathname.startsWith("/v2/explore/contacts") ||
    pathname.startsWith("/v2/crm/contacts") ||
    pathname === "/v2/crm" ||
    pathname === "/v2/contacts"
  ) {
    return { title: "Filtri Contatti CRM", content: <CRMFiltersSection /> };
  }

  // CRM › Biglietti: i filtri vivono nella linguetta globale (rail) come
  // per WCA Partner. La pagina non ha più la propria sidebar interna.
  if (pathname.startsWith("/v2/pipeline/biglietti") || pathname.startsWith("/v2/explore/biglietti")) {
    return { title: "Filtri Biglietti BCA", content: <BCAFiltersRailContent /> };
  }

  return null;
}

export function ContextFiltersRail(): React.ReactElement | null {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);
  const asideRef = React.useRef<HTMLElement | null>(null);
  const toggleRef = React.useRef<HTMLButtonElement | null>(null);
  const [networkView, setNetworkView] = React.useState<"partners" | "bca">(() => {
    try { return (sessionStorage.getItem("network-view") as "partners" | "bca") || "partners"; }
    catch { return "partners"; }
  });
  React.useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ view: "partners" | "bca" }>).detail;
      if (detail?.view === "partners" || detail?.view === "bca") setNetworkView(detail.view);
    };
    window.addEventListener("network-view-change", onChange);
    return () => window.removeEventListener("network-view-change", onChange);
  }, []);

  const context = getFilterContext(pathname, networkView);

  React.useEffect(() => {
    setIsOpen(false);
  }, [pathname, networkView]);

  React.useEffect(() => {
    const onOpenDrawer = (e: Event) => {
      const detail = (e as CustomEvent<{ drawer?: string }>).detail;
      if (detail?.drawer === "filters") setIsOpen(true);
    };
    window.addEventListener("open-drawer", onOpenDrawer);
    return () => window.removeEventListener("open-drawer", onOpenDrawer);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (asideRef.current?.contains(target)) return;
      if (toggleRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  if (!context) return null;

  // Tutte le sidebar dei filtri restano SEMPRE a scomparsa con linguetta,
  // anche su desktop full-width. Nessuna sidebar fissa. Richiesta dell'utente.
  return (
    <div className={isOpen ? "flex w-80 shrink-0" : "block w-0 shrink-0"}>
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={[
          "fixed top-1/2 -translate-y-1/2 z-[60] flex h-14 w-7 items-center justify-center rounded-r-lg border border-l-0 border-primary/30 bg-primary/20 text-primary backdrop-blur-md transition-all hover:border-primary/50 hover:bg-primary/25",
          isOpen ? "left-80" : "left-0",
        ].join(" ")}
        aria-label={isOpen ? `Chiudi ${context.title}` : `Apri ${context.title}`}
        aria-expanded={isOpen}
      >
        {isOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <SlidersHorizontal className="h-3.5 w-3.5" />}
      </button>

      {isOpen && (
        <aside ref={asideRef} className="flex h-full w-80 shrink-0 flex-col border-r border-border/40 bg-card/45 backdrop-blur-sm" aria-label={context.title}>
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border/40 px-4">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold uppercase text-foreground">{context.title}</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-5 [&>section+section]:border-t [&>section+section]:border-border/40 [&>section+section]:pt-4 [&>div+section]:border-t [&>div+section]:border-border/40 [&>div+section]:pt-4">
            {context.content}
          </div>
        </aside>
      )}
    </div>
  );
}

export default ContextFiltersRail;
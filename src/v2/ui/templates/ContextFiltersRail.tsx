import * as React from "react";
import { useLocation } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { NetworkFiltersSection } from "@/components/global/filters-drawer/NetworkFiltersSection";
import { CRMFiltersSection } from "@/components/global/filters-drawer/CRMFiltersSection";

function getFilterContext(pathname: string, networkView: "partners" | "bca"): { title: string; content: React.ReactNode } | null {
  if (pathname.startsWith("/v2/explore/network") || pathname === "/v2/network") {
    // BCA tab inside Network has its own country sidebar inside the view — avoid duplicate.
    if (networkView === "bca") return null;
    return { title: "Filtri WCA Partner", content: <NetworkFiltersSection /> };
  }

  if (pathname.startsWith("/v2/pipeline/contacts") || pathname.startsWith("/v2/pipeline/kanban") || pathname.startsWith("/v2/crm/contacts") || pathname === "/v2/crm" || pathname === "/v2/contacts") {
    return { title: "Filtri Contatti CRM", content: <CRMFiltersSection /> };
  }

  // CRM › Biglietti: la maschera (BCAUnifiedHub) ha già la sua sidebar paesi/filtri
  // ricca e funzionante — niente rail esterno duplicato.

  return null;
}

export function ContextFiltersRail(): React.ReactElement | null {
  const { pathname } = useLocation();
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

  if (!context) return null;

  return (
    <aside className="hidden lg:flex w-80 shrink-0 flex-col border-r border-border/40 bg-card/45 backdrop-blur-sm" aria-label={context.title}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border/40 px-4">
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        <h2 className="text-xs font-bold uppercase text-foreground">{context.title}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {context.content}
      </div>
    </aside>
  );
}

export default ContextFiltersRail;
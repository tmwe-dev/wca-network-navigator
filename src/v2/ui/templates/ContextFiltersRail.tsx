import * as React from "react";
import { useLocation } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
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

export function ContextFiltersRail(): React.ReactElement | null {
  const { pathname } = useLocation();
  const context = getFilterContext(pathname);

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
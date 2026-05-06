import * as React from "react";
import { useLocation } from "react-router-dom";
import { PanelLeftClose, SlidersHorizontal, Check } from "lucide-react";
import { NetworkFiltersSection } from "@/components/global/filters-drawer/NetworkFiltersSection";
import { CRMFiltersSection } from "@/components/global/filters-drawer/CRMFiltersSection";
import { BCAFiltersRailContent } from "@/components/contacts/bca/BCAFiltersRailContent";
import { EmailIntelligenceFiltersSection } from "@/components/global/filters-drawer/EmailIntelligenceFiltersSection";
import { EmailComposeFiltersSection } from "@/components/global/filters-drawer/EmailComposeFiltersSection";
import { AgendaFiltersSection } from "@/components/global/filters-drawer/AgendaFiltersSection";
import { CampaignsFiltersSection } from "@/components/global/filters-drawer/CampaignsFiltersSection";
import { FunnemailInboxFiltersSection } from "@/components/global/filters-drawer/FunnemailInboxFiltersSection";
import { SortingFiltersSection } from "@/components/global/filters-drawer/SortingFiltersSection";
import { ArenaFiltersSection } from "@/components/global/filters-drawer/ArenaFiltersSection";
import { EmailForgeFiltersSection } from "@/components/global/filters-drawer/EmailForgeFiltersSection";
import { SidebarBanner } from "@/components/global/filters-drawer/SidebarBanner";
import {
  SIDEBAR_BANNER_REGISTRY,
  type SidebarContextKey,
} from "@/components/global/filters-drawer/sidebarContextRegistry";

function getFilterContext(
  pathname: string,
  networkView: "partners" | "bca",
): { title: string; content: React.ReactNode; bannerKey: SidebarContextKey } | null {
  if (pathname.startsWith("/v2/explore/network") || pathname === "/v2/network" || pathname.startsWith("/v2/partner-hub")) {
    if (networkView === "bca") {
      return { title: "Filtri Biglietti BCA", content: <BCAFiltersRailContent />, bannerKey: "bca" };
    }
    return { title: "Filtri WCA Partner", content: <NetworkFiltersSection />, bannerKey: "network" };
  }

  if (
    pathname.startsWith("/v2/pipeline/contacts") ||
    pathname.startsWith("/v2/pipeline/kanban") ||
    pathname.startsWith("/v2/explore/contacts") ||
    pathname.startsWith("/v2/crm/contacts") ||
    pathname === "/v2/crm" ||
    pathname === "/v2/contacts"
  ) {
    return { title: "Filtri Contatti CRM", content: <CRMFiltersSection />, bannerKey: "crm-contacts" };
  }

  if (pathname.startsWith("/v2/pipeline/biglietti") || pathname.startsWith("/v2/explore/biglietti")) {
    return { title: "Filtri Biglietti BCA", content: <BCAFiltersRailContent />, bannerKey: "bca" };
  }

  if (pathname.startsWith("/v2/email-intelligence")) {
    return {
      title: "Filtri Email Intelligence",
      content: <EmailIntelligenceFiltersSection />,
      bannerKey: "email-intelligence",
    };
  }

  if (pathname.startsWith("/v2/communicate/compose")) {
    return {
      title: "Configurazione Email AI",
      content: <EmailComposeFiltersSection />,
      bannerKey: "email-compose",
    };
  }

  if (pathname.startsWith("/v2/cockpit")) {
    return {
      title: "Configurazione Email AI",
      content: <EmailComposeFiltersSection />,
      bannerKey: "email-compose",
    };
  }

  if (pathname.startsWith("/v2/email-forge")) {
    return {
      title: "Configurazione Email AI",
      content: <EmailComposeFiltersSection />,
      bannerKey: "email-forge",
    };
  }

  if (pathname.startsWith("/v2/ai-staff/email-forge")) {
    return { title: "Email Forge — Lab AI", content: <EmailForgeFiltersSection />, bannerKey: "email-forge" };
  }

  if (pathname.startsWith("/v2/agenda") || pathname.startsWith("/v2/pipeline/agenda")) {
    return { title: "Filtri Agenda", content: <AgendaFiltersSection />, bannerKey: "agenda" };
  }

  if (pathname.startsWith("/v2/campaigns")) {
    return { title: "Filtri Campagne", content: <CampaignsFiltersSection />, bannerKey: "campaigns" };
  }

  if (pathname.startsWith("/v2/funnemail-inbox") || pathname.startsWith("/v2/inbox")) {
    return { title: "Filtri Funnemail", content: <FunnemailInboxFiltersSection />, bannerKey: "funnemail-inbox" };
  }

  if (pathname.startsWith("/v2/sorting")) {
    return { title: "Filtri Approvazioni", content: <SortingFiltersSection />, bannerKey: "sorting" };
  }

  if (pathname.startsWith("/v2/ai-arena")) {
    return { title: "AI Arena — Focus", content: <ArenaFiltersSection />, bannerKey: "arena" };
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

  // Nessun auto-close su click esterno: la sidebar è multi-selezione,
  // l'utente la chiude esplicitamente con il tasto "Conferma" o la linguetta.

  if (!context) return null;

  // Pattern OVERLAY: la sidebar si apre SOPRA il contenuto (fixed + backdrop
  // oscurato) senza spostare nulla. La pagina sottostante resta in posizione,
  // viene solo oscurata. Richiesta dell'utente.
  // L'<aside> è sempre montato (anche chiuso) per preservare lo stato dei
  // filtri, ma è translato fuori schermo quando chiuso.
  return (
    <>
      {/* Linguetta SEMPRE visibile, fissa al bordo sinistro */}
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={[
          "fixed top-1/2 -translate-y-1/2 z-[70] flex h-14 w-7 items-center justify-center rounded-r-lg border border-l-0 border-primary/30 bg-primary/20 text-primary backdrop-blur-md transition-all duration-200 hover:border-primary/50 hover:bg-primary/25",
          isOpen ? "left-80" : "left-0",
        ].join(" ")}
        aria-label={isOpen ? `Chiudi ${context.title}` : `Apri ${context.title}`}
        aria-expanded={isOpen}
      >
        {isOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <SlidersHorizontal className="h-3.5 w-3.5" />}
      </button>

      {/* Backdrop oscurato — clic per chiudere */}
      <div
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
        className={[
          "fixed inset-0 z-[55] bg-black/40 backdrop-blur-[1px] transition-opacity duration-200",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      {/* Pannello sidebar — fixed, slide-in da sinistra, sopra il contenuto */}
      <aside
        ref={asideRef}
        className={[
          "fixed left-0 top-0 z-[60] flex h-screen w-80 flex-col border-r border-border/40 bg-card/95 backdrop-blur-md shadow-2xl transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        aria-label={context.title}
        aria-hidden={!isOpen}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border/40 px-4">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold uppercase text-foreground">{context.title}</h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="ml-auto inline-flex h-7 items-center gap-1 rounded-md bg-card/60 dark:bg-card/40 border border-primary/60 px-2.5 text-[11px] font-semibold text-primary hover:bg-primary/15 hover:border-primary transition-colors"
              aria-label="Conferma e chiudi filtri"
            >
              <Check className="h-3 w-3" /> Conferma
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {context.bannerKey !== "email-compose" && (() => {
              const meta = SIDEBAR_BANNER_REGISTRY[context.bannerKey];
              return (
                <SidebarBanner
                  icon={meta.icon}
                  title={meta.title}
                  description={meta.description}
                  tone={meta.tone}
                />
              );
            })()}
            <div className="space-y-4 [&>section+section]:border-t [&>section+section]:border-border/40 [&>section+section]:pt-4 [&>div+section]:border-t [&>div+section]:border-border/40 [&>div+section]:pt-4">
              {context.content}
            </div>
          </div>
          <div className="shrink-0 border-t border-border/40 bg-card/60 px-4 py-3">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-card/60 dark:bg-card/40 border border-primary/60 text-primary text-xs font-semibold hover:bg-primary/15 hover:border-primary transition-colors"
            >
              <Check className="h-3.5 w-3.5" /> Conferma e chiudi
            </button>
          </div>
      </aside>
    </>
  );
}

export default ContextFiltersRail;
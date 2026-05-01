/**
 * ExploreContextHeader — UNICA barra superiore per la sezione Esplora.
 *
 * Sostituisce GoldenHeaderBar (breadcrumb) + SectionTabs (tab strip).
 * Mostra: ‹  [icona] [Nome tab attiva] · [counter dinamico]  ›   [actions]
 *
 * Interazioni:
 *  - Click sul titolo → naviga alla tab successiva nel ciclo.
 *  - Frecce ‹ › → prev/next esplicito.
 *  - La tab attiva è derivata da `useLocation()`.
 *
 * Slot azioni: le pagine possono iniettare controlli via Portal usando
 * l'id `explore-header-actions` (lo slot a destra). Pattern già usato
 * in LayoutHeader (`campaign-header-controls`).
 */
import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Globe, Users, IdCard, Map as MapIcon, SearchCheck, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useExploreTabCounters, type ExploreTabCounters } from "@/v2/hooks/useExploreTabCounters";

type TabKey = "network" | "contacts" | "biglietti" | "map" | "deep";

interface TabDef {
  readonly key: TabKey;
  readonly label: string;
  readonly to: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly counterKey?: keyof ExploreTabCounters;
  readonly unitLabel?: string;
  readonly matchPaths: readonly string[];
}

const TABS: readonly TabDef[] = [
  { key: "network",   label: "WCA Partner",   to: "/v2/explore/network",     icon: Globe,       counterKey: "network",   unitLabel: "partner",  matchPaths: ["/v2/explore/network"] },
  { key: "contacts",  label: "Contatti CRM",  to: "/v2/explore/contacts",    icon: Users,       counterKey: "contacts",  unitLabel: "contatti", matchPaths: ["/v2/explore/contacts"] },
  { key: "biglietti", label: "Biglietti",     to: "/v2/explore/biglietti",   icon: IdCard,      counterKey: "biglietti", unitLabel: "biglietti", matchPaths: ["/v2/explore/biglietti"] },
  { key: "map",       label: "Mappa",         to: "/v2/explore/map",         icon: MapIcon,     counterKey: "map",       unitLabel: "paesi",    matchPaths: ["/v2/explore/map"] },
  { key: "deep",      label: "Sherlock",      to: "/v2/explore/deep-search", icon: SearchCheck,                                                  matchPaths: ["/v2/explore/deep-search"] },
] as const;

function formatNumber(n: number | null): string {
  if (n === null) return "…";
  return n.toLocaleString("it-IT");
}

function findActiveIndex(pathname: string): number {
  const idx = TABS.findIndex((t) => t.matchPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`)));
  return idx === -1 ? 0 : idx;
}

/**
 * ExploreContextHeader — montato direttamente nel LayoutHeader.
 * Si auto-nasconde fuori dalla sezione /v2/explore.
 */
export function ExploreContextHeader(): React.ReactElement | null {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const counters = useExploreTabCounters();

  const inExplore = pathname.startsWith("/v2/explore");
  const activeIdx = findActiveIndex(pathname);
  const active = TABS[activeIdx];
  const Icon = active.icon;

  const goTo = React.useCallback((delta: number) => {
    const next = (activeIdx + delta + TABS.length) % TABS.length;
    navigate(TABS[next].to);
  }, [activeIdx, navigate]);

  if (!inExplore) return null;

  const counterValue = active.counterKey ? counters[active.counterKey] : null;
  const showCounter = active.counterKey !== undefined;

  const nextTab = TABS[(activeIdx + 1) % TABS.length];

  return (
    <div
      className="flex items-center gap-1 min-w-0"
      data-testid="explore-context-header"
    >
      <button
        type="button"
        onClick={() => goTo(-1)}
        className="h-7 w-6 inline-flex items-center justify-center rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 transition-colors"
        aria-label="Tab precedente"
        title="Tab precedente"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={() => goTo(1)}
        className={cn(
          "group flex items-center gap-2 min-w-0 px-2 h-7 rounded-md",
          "hover:bg-muted/40 transition-colors",
        )}
        aria-label={`Sezione ${active.label}. Click per passare a ${nextTab.label}.`}
        title={`Vai a: ${nextTab.label}`}
        data-testid="explore-header-cycler"
      >
        <Icon className="h-4 w-4 text-primary/80 shrink-0" />
        <span className="text-sm font-semibold text-foreground truncate">
          {active.label}
        </span>
        {showCounter && (
          <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            · <span className="font-mono">{formatNumber(counterValue)}</span>
            {active.unitLabel && <span className="ml-1">{active.unitLabel}</span>}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => goTo(1)}
        className="h-7 w-6 inline-flex items-center justify-center rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 transition-colors"
        aria-label="Tab successiva"
        title={`Vai a: ${nextTab.label}`}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      {/* Slot azioni iniettato dalle pagine via Portal (id stabile) */}
      <div
        id="explore-header-actions"
        className="flex items-center gap-2 shrink-0 ml-2"
      />
    </div>
  );
}

export default ExploreContextHeader;
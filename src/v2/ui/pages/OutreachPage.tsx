/**
 * OutreachPage V2 — Cockpit puro.
 *
 * La sub-tab "Strumenti" (Sequenze, Coda AI, A/B Test) è stata estratta
 * e spostata in Config → "Strumenti Outreach" (`/v2/settings/outreach-tools`):
 * la pagina Outreach è di pura operatività outbound, senza ridondanze
 * con Cockpit. Coda AI resta inoltre raggiungibile dal Cestinone.
 */
import { Suspense, useEffect } from "react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { lazyRetry } from "@/lib/lazyRetry";
import { OutreachStatsHeader } from "@/components/outreach/OutreachStatsHeader";
import { OutreachLegendFooter } from "@/components/outreach/OutreachLegendFooter";

const CockpitContent = lazyRetry(() => import("./CockpitPage").then(m => ({ default: m.CockpitPage })));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export function OutreachPage() {
  const { setOutreachTab } = useGlobalFilters();

  // Manteniamo il filtro globale coerente: la pagina è sempre "cockpit".
  useEffect(() => { setOutreachTab("cockpit"); }, [setOutreachTab]);

  return (
    <div data-testid="page-outreach" className="flex flex-col h-full overflow-hidden">
      <OutreachStatsHeader />
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={<TabFallback />}>
          <CockpitContent />
        </Suspense>
      </div>
      <OutreachLegendFooter />
    </div>
  );
}

/**
 * OutreachPage V2 — Standalone V1 content migration (NO wrapper)
 */
import { Suspense, useState, useEffect } from "react";
import { Rocket, ArrowUpFromLine, ListTodo, Plane, Wrench } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";
import { lazyRetry } from "@/lib/lazyRetry";
import { OutreachStatsHeader } from "@/components/outreach/OutreachStatsHeader";
import { OutreachLegendFooter } from "@/components/outreach/OutreachLegendFooter";

const OutreachMiniCharts = lazyRetry(() => import("@/components/analytics/OutreachMiniCharts").then(m => ({ default: m.OutreachMiniCharts })));
const CockpitContent = lazyRetry(() => import("./CockpitPage").then(m => ({ default: m.CockpitPage })));
const InUscitaTab = lazyRetry(() => import("@/components/outreach/InUscitaTab").then(m => ({ default: m.InUscitaTab })));
const AttivitaTab = lazyRetry(() => import("@/components/outreach/AttivitaTab").then(m => ({ default: m.AttivitaTab })));
const HoldingPatternTab = lazyRetry(() => import("@/components/outreach/HoldingPatternCommandCenter").then(m => ({ default: m.HoldingPatternCommandCenter })));
const ToolsTab = lazyRetry(() => import("@/components/outreach/ToolsTab").then(m => ({ default: m.ToolsTab })));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export function OutreachPage() {
  const [tab, setTab] = useState("cockpit");
  const { setOutreachTab } = useGlobalFilters();

  useEffect(() => { setOutreachTab(tab); }, [tab, setOutreachTab]);

  const tabs: VerticalTab[] = [
    { value: "cockpit",  label: "Cockpit",   icon: Rocket },
    { value: "inuscita", label: "In Uscita", icon: ArrowUpFromLine },
    { value: "circuito", label: "Risposte",  icon: Plane },
    { value: "attivita", label: "Attività",  icon: ListTodo },
    { value: "strumenti", label: "Strumenti", icon: Wrench },
  ];

  return (
    <div data-testid="page-outreach" className="flex flex-col h-full overflow-hidden">
      <OutreachStatsHeader />

      <Suspense fallback={<div className="h-24 animate-pulse bg-muted rounded-lg" />}>
        <OutreachMiniCharts />
      </Suspense>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <VerticalTabNav tabs={tabs} value={tab} onChange={setTab} />
        <div className="flex-1 min-w-0 overflow-hidden">
          <Suspense fallback={<TabFallback />}>
            {tab === "cockpit"   && <CockpitContent />}
            {tab === "inuscita"  && <InUscitaTab onNavigate={setTab} />}
            {tab === "circuito"  && <HoldingPatternTab />}
            {tab === "attivita"  && <AttivitaTab />}
            {tab === "strumenti" && <ToolsTab onNavigate={setTab} />}
          </Suspense>
        </div>
      </div>
      <OutreachLegendFooter />
    </div>
  );
}

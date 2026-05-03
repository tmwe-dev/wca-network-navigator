/**
 * OutreachPage V2 — Standalone V1 content migration (NO wrapper)
 */
import { Suspense, useState, useEffect } from "react";
import { Rocket, Wrench } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";
import { lazyRetry } from "@/lib/lazyRetry";
import { OutreachStatsHeader } from "@/components/outreach/OutreachStatsHeader";
import { OutreachLegendFooter } from "@/components/outreach/OutreachLegendFooter";

const CockpitContent = lazyRetry(() => import("./CockpitPage").then(m => ({ default: m.CockpitPage })));
const ToolsTab = lazyRetry(() => import("@/components/outreach/ToolsTab").then(m => ({ default: m.ToolsTab })));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export function OutreachPage() {
  const [tab, setTab] = useState("cockpit");
  const { setOutreachTab } = useGlobalFilters();

  useEffect(() => { setOutreachTab(tab); }, [tab, setOutreachTab]);

  const tabs: VerticalTab[] = [
    { value: "cockpit",  label: "Cockpit",   icon: Rocket, tooltip: "Centro di comando outbound: stats, mini-grafici e azioni rapide." },
    { value: "strumenti", label: "Strumenti", icon: Wrench, tooltip: "Sequenze, Coda AI (azioni proposte dagli agenti che attendono approvazione) e A/B Test (confronto varianti subject/body)." },
  ];

  // Outreach è interamente OUTBOUND: header sempre visibile.
  const showStatsHeader = true;

  return (
    <div data-testid="page-outreach" className="flex flex-col h-full overflow-hidden">
      {showStatsHeader && <OutreachStatsHeader />}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <VerticalTabNav tabs={tabs} value={tab} onChange={setTab} />
        <div className="flex-1 min-w-0 overflow-hidden">
          <Suspense fallback={<TabFallback />}>
            {tab === "cockpit"   && <CockpitContent />}
            {tab === "strumenti" && <ToolsTab onNavigate={setTab} />}
          </Suspense>
        </div>
      </div>
      <OutreachLegendFooter />
    </div>
  );
}

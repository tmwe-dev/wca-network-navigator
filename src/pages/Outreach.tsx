import { Suspense, useState, useEffect } from "react";
import { Rocket, ArrowUpFromLine, ListTodo, Plane, Bot, TestTube2, ClipboardList } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";
import { lazyRetry } from "@/lib/lazyRetry";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOutreachMock } from "@/hooks/useOutreachMock";
import { cn } from "@/lib/utils";
import { OutreachStatsHeader } from "@/components/outreach/OutreachStatsHeader";

const WorkPlanDashboard = lazyRetry(() => import("@/components/outreach/WorkPlanDashboard").then(m => ({ default: m.WorkPlanDashboard })));
const Cockpit = lazyRetry(() => import("./Cockpit"));
const InUscitaTab = lazyRetry(() => import("@/components/outreach/InUscitaTab").then(m => ({ default: m.InUscitaTab })));
const AttivitaTab = lazyRetry(() => import("@/components/outreach/AttivitaTab").then(m => ({ default: m.AttivitaTab })));
const HoldingPatternTab = lazyRetry(() => import("@/components/outreach/HoldingPatternCommandCenter").then(m => ({ default: m.HoldingPatternCommandCenter })));
const CodaAITab = lazyRetry(() => import("@/components/outreach/CodaAITab").then(m => ({ default: m.CodaAITab })));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export default function Outreach() {
  const [tab, setTab] = useState("cockpit");
  const { setOutreachTab } = useGlobalFilters();
  const { mockEnabled, toggleMock } = useOutreachMock();

  useEffect(() => { setOutreachTab(tab); }, [tab, setOutreachTab]);

  const tabs: VerticalTab[] = [
    { value: "cockpit", label: "Cockpit", icon: Rocket },
    { value: "inuscita", label: "In Uscita", icon: ArrowUpFromLine },
    { value: "attivita", label: "Attività", icon: ListTodo },
    { value: "circuito", label: "Circuito", icon: Plane },
    { value: "coda-ai", label: "Coda AI", icon: Bot },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <OutreachStatsHeader />
      {/* Mock toggle header */}
      <div className="shrink-0 flex items-center justify-end px-3 py-1 border-b border-border/30">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant={mockEnabled ? "default" : "ghost"}
              className={cn("h-6 text-[10px] gap-1 px-2", mockEnabled && "bg-amber-500 hover:bg-amber-600 text-white")}
              onClick={toggleMock}
            >
              <TestTube2 className="w-3 h-3" />
              {mockEnabled ? "Mock ON" : "Mock"}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p className="text-xs">Mostra/nascondi dati demo temporanei</p></TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <VerticalTabNav tabs={tabs} value={tab} onChange={setTab} />
        <div className="flex-1 min-w-0 overflow-hidden">
          <Suspense fallback={<TabFallback />}>
            {tab === "cockpit" && <Cockpit />}
            {tab === "inuscita" && <InUscitaTab />}
            {tab === "attivita" && <AttivitaTab />}
            {tab === "circuito" && <HoldingPatternTab />}
            {tab === "coda-ai" && <CodaAITab />}
          </Suspense>
        </div>
      </div>
    </div>
  );
}

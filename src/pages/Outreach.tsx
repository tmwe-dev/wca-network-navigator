import { lazy, Suspense, useState, useEffect } from "react";
import { Rocket, ArrowUpFromLine, ListTodo, Plane, Inbox } from "lucide-react";
import { AttivitaTab } from "@/components/outreach/AttivitaTab";
import { InUscitaTab } from "@/components/outreach/InUscitaTab";
import { HoldingPatternTab } from "@/components/outreach/HoldingPatternTab";
import { InboxView } from "@/components/outreach/InboxView";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useUnreadCount } from "@/hooks/useChannelMessages";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";

const Cockpit = lazy(() => import("./Cockpit"));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export default function Outreach() {
  const [tab, setTab] = useState("cockpit");
  const { setOutreachTab } = useGlobalFilters();
  const { data: unreadCount = 0 } = useUnreadCount();

  useEffect(() => { setOutreachTab(tab); }, [tab, setOutreachTab]);

  const tabs: VerticalTab[] = [
    { value: "cockpit", label: "Cockpit", icon: Rocket },
    { value: "inuscita", label: "In Uscita", icon: ArrowUpFromLine },
    { value: "attivita", label: "Attività", icon: ListTodo },
    { value: "circuito", label: "Circuito", icon: Plane },
    { value: "messaggi", label: "Messaggi", icon: Inbox, badge: unreadCount },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      <VerticalTabNav tabs={tabs} value={tab} onChange={setTab} />
      <div className="flex-1 min-w-0 overflow-hidden">
        {tab === "cockpit" && (
          <Suspense fallback={<TabFallback />}>
            <Cockpit />
          </Suspense>
        )}
        {tab === "inuscita" && <InUscitaTab />}
        {tab === "attivita" && <AttivitaTab />}
        {tab === "circuito" && <HoldingPatternTab />}
        {tab === "messaggi" && <InboxView />}
      </div>
    </div>
  );
}

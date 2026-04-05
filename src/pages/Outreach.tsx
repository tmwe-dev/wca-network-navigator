import { Suspense, useState, useEffect } from "react";
import { Rocket, ArrowUpFromLine, ListTodo, Plane, Inbox } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useUnreadCount } from "@/hooks/useChannelMessages";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";
import { lazyRetry } from "@/lib/lazyRetry";

const Cockpit = lazyRetry(() => import("./Cockpit"));
const InArrivoTab = lazyRetry(() => import("@/components/outreach/InArrivoTab").then(m => ({ default: m.InArrivoTab })));
const InUscitaTab = lazyRetry(() => import("@/components/outreach/InUscitaTab").then(m => ({ default: m.InUscitaTab })));
const AttivitaTab = lazyRetry(() => import("@/components/outreach/AttivitaTab").then(m => ({ default: m.AttivitaTab })));
const HoldingPatternTab = lazyRetry(() => import("@/components/outreach/HoldingPatternTab").then(m => ({ default: m.HoldingPatternTab })));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export default function Outreach() {
  const [tab, setTab] = useState("cockpit");
  const { setOutreachTab } = useGlobalFilters();
  const { data: emailUnread = 0 } = useUnreadCount("email");
  const { data: waUnread = 0 } = useUnreadCount("whatsapp");
  const { data: liUnread = 0 } = useUnreadCount("linkedin");

  useEffect(() => { setOutreachTab(tab); }, [tab, setOutreachTab]);

  const totalIncoming = emailUnread + waUnread + liUnread;

  const tabs: VerticalTab[] = [
    { value: "cockpit", label: "Cockpit", icon: Rocket },
    { value: "inarrivo", label: "In Arrivo", icon: Inbox, badge: totalIncoming },
    { value: "inuscita", label: "In Uscita", icon: ArrowUpFromLine },
    { value: "attivita", label: "Attività", icon: ListTodo },
    { value: "circuito", label: "Circuito", icon: Plane },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <VerticalTabNav tabs={tabs} value={tab} onChange={setTab} />
        <div className="flex-1 min-w-0 overflow-hidden">
          <Suspense fallback={<TabFallback />}>
            {tab === "cockpit" && <Cockpit />}
            {tab === "inarrivo" && <InArrivoTab />}
            {tab === "inuscita" && <InUscitaTab />}
            {tab === "attivita" && <AttivitaTab />}
            {tab === "circuito" && <HoldingPatternTab />}
          </Suspense>
        </div>
      </div>
    </div>
  );
}

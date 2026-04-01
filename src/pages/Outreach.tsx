import { lazy, Suspense, useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Rocket, ArrowUpFromLine, ListTodo, Plane, Inbox } from "lucide-react";
import { AttivitaTab } from "@/components/outreach/AttivitaTab";
import { InUscitaTab } from "@/components/outreach/InUscitaTab";
import { HoldingPatternTab } from "@/components/outreach/HoldingPatternTab";
import { InboxView } from "@/components/outreach/InboxView";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useUnreadCount } from "@/hooks/useChannelMessages";

const Cockpit = lazy(() => import("./Cockpit"));

function TabFallback() {
  return <div className="h-[calc(100vh-6rem)] animate-pulse bg-muted/20 rounded-lg" />;
}

export default function Outreach() {
  const [tab, setTab] = useState("cockpit");
  const { setOutreachTab } = useGlobalFilters();
  const { data: unreadCount = 0 } = useUnreadCount();

  useEffect(() => { setOutreachTab(tab); }, [tab, setOutreachTab]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-border bg-background/80 backdrop-blur-sm px-4 pt-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="cockpit" className="gap-1.5 text-xs">
              <Rocket className="w-3.5 h-3.5" />
              Cockpit
            </TabsTrigger>
            <TabsTrigger value="inuscita" className="gap-1.5 text-xs">
              <ArrowUpFromLine className="w-3.5 h-3.5" />
              In Uscita
            </TabsTrigger>
            <TabsTrigger value="attivita" className="gap-1.5 text-xs">
              <ListTodo className="w-3.5 h-3.5" />
              Attività
            </TabsTrigger>
            <TabsTrigger value="circuito" className="gap-1.5 text-xs">
              <Plane className="w-3.5 h-3.5" />
              Circuito
            </TabsTrigger>
            <TabsTrigger value="messaggi" className="gap-1.5 text-xs relative">
              <Inbox className="w-3.5 h-3.5" />
              Messaggi
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "cockpit" && (
          <Suspense fallback={<TabFallback />}>
            <Cockpit />
          </Suspense>
        )}
        {tab === "inuscita" && <InUscitaTab />}
        {tab === "attivita" && <AttivitaTab />}
        {tab === "circuito" && <HoldingPatternTab />}
      </div>
    </div>
  );
}

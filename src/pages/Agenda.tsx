import { lazy, Suspense, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Zap, LayoutGrid, List, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const Reminders = lazy(() => import("./Reminders"));
const HubOperativo = lazy(() => import("./HubOperativo"));
const AgendaCardView = lazy(() => import("@/components/agenda/AgendaCardView"));
const AgendaListView = lazy(() => import("@/components/agenda/AgendaListView"));
const ActivitiesTab = lazy(() => import("@/components/agenda/ActivitiesTab"));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

type PartnerViewMode = "cards" | "list";

export default function Agenda() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "pipeline"
    ? "pipeline"
    : searchParams.get("tab") === "partner"
    ? "partner"
    : searchParams.get("tab") === "attivita"
    ? "attivita"
    : "calendario";
  const [tab, setTab] = useState(initialTab);
  const [partnerView, setPartnerView] = useState<PartnerViewMode>("cards");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Glass top bar */}
      <div className="flex-shrink-0 border-b border-border/50 glass-panel px-4 py-2">
        <div className="flex items-center justify-between">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-muted/30 backdrop-blur-sm">
              <TabsTrigger value="calendario" className="gap-1.5 text-xs">
                <Calendar className="w-3.5 h-3.5" />
                Calendario
              </TabsTrigger>
              <TabsTrigger value="partner" className="gap-1.5 text-xs">
                <LayoutGrid className="w-3.5 h-3.5" />
                Partner
              </TabsTrigger>
              <TabsTrigger value="attivita" className="gap-1.5 text-xs">
                <Activity className="w-3.5 h-3.5" />
                Attività
              </TabsTrigger>
              <TabsTrigger value="pipeline" className="gap-1.5 text-xs">
                <Zap className="w-3.5 h-3.5" />
                Pipeline
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Partner view toggle — only when on partner tab */}
          {tab === "partner" && (
            <div className="flex items-center gap-1 bg-muted/30 rounded-md p-0.5">
              <button
                onClick={() => setPartnerView("cards")}
                className={cn(
                  "p-1.5 rounded transition-all",
                  partnerView === "cards"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPartnerView("list")}
                className={cn(
                  "p-1.5 rounded transition-all",
                  partnerView === "list"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "calendario" && (
          <Suspense fallback={<TabFallback />}>
            <Reminders />
          </Suspense>
        )}
        {tab === "partner" && (
          <Suspense fallback={<TabFallback />}>
            {partnerView === "cards" ? <AgendaCardView /> : <AgendaListView />}
          </Suspense>
        )}
        {tab === "attivita" && (
          <Suspense fallback={<TabFallback />}>
            <ActivitiesTab />
          </Suspense>
        )}
        {tab === "pipeline" && (
          <Suspense fallback={<TabFallback />}>
            <HubOperativo />
          </Suspense>
        )}
      </div>
    </div>
  );
}

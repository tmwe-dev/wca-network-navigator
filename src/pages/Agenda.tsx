import { lazy, Suspense, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Zap } from "lucide-react";

const Reminders = lazy(() => import("./Reminders"));
const HubOperativo = lazy(() => import("./HubOperativo"));

function TabFallback() {
  return <div className="h-[calc(100vh-6rem)] animate-pulse bg-muted/20 rounded-lg" />;
}

export default function Agenda() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "pipeline" ? "pipeline" : "calendario";
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-border bg-background/80 backdrop-blur-sm px-4 pt-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="calendario" className="gap-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5" />
              Calendario
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1.5 text-xs">
              <Zap className="w-3.5 h-3.5" />
              Pipeline
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "calendario" && (
          <Suspense fallback={<TabFallback />}>
            <Reminders />
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

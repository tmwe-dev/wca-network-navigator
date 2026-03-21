import { lazy, Suspense, useState, useRef } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Globe, Rocket, Gauge } from "lucide-react";

const SuperHome3D = lazy(() => import("./SuperHome3D"));
const GlobalPage = lazy(() => import("./Global"));
const Campaigns = lazy(() => import("./Campaigns"));
const OperationsCenterLazy = lazy(() => import("@/components/home/OperationsCenter").then(m => ({ default: m.OperationsCenter })));

function TabFallback() {
  return <div className="h-[calc(100vh-6rem)] animate-pulse bg-muted/20 rounded-lg" />;
}

export default function Dashboard() {
  const [tab, setTab] = useState("home");
  const containerRef = useRef<HTMLDivElement>(null);

  // No wheel/popstate hijacking needed with clean scroll layout

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full overflow-hidden"
      style={{ overscrollBehavior: "none" }}
    >
      <div className="flex-shrink-0 border-b border-border bg-background/80 backdrop-blur-sm px-4 pt-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="home" className="gap-1.5 text-xs">
              <LayoutDashboard className="w-3.5 h-3.5" />
              Mission Control
            </TabsTrigger>
            <TabsTrigger value="global" className="gap-1.5 text-xs">
              <Globe className="w-3.5 h-3.5" />
              Global AI
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1.5 text-xs">
              <Rocket className="w-3.5 h-3.5" />
              Campagne
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden" style={{ overscrollBehavior: "none" }}>
        {tab === "home" && (
          <Suspense fallback={<TabFallback />}>
            <SuperHome3D />
          </Suspense>
        )}
        {tab === "global" && (
          <Suspense fallback={<TabFallback />}>
            <GlobalPage />
          </Suspense>
        )}
        {tab === "campaigns" && (
          <Suspense fallback={<TabFallback />}>
            <Campaigns />
          </Suspense>
        )}
      </div>
    </div>
  );
}

import { lazy, Suspense, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Rocket, PackageCheck, Send } from "lucide-react";
import { CampagneTab } from "@/components/outreach/CampagneTab";

const Cockpit = lazy(() => import("./Cockpit"));
const Sorting = lazy(() => import("./Sorting"));

function TabFallback() {
  return <div className="h-[calc(100vh-6rem)] animate-pulse bg-muted/20 rounded-lg" />;
}

export default function Outreach() {
  const [tab, setTab] = useState("cockpit");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-border bg-background/80 backdrop-blur-sm px-4 pt-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="cockpit" className="gap-1.5 text-xs">
              <Rocket className="w-3.5 h-3.5" />
              Cockpit
            </TabsTrigger>
            <TabsTrigger value="sorting" className="gap-1.5 text-xs">
              <PackageCheck className="w-3.5 h-3.5" />
              In Uscita
            </TabsTrigger>
            <TabsTrigger value="campagne" className="gap-1.5 text-xs">
              <Send className="w-3.5 h-3.5" />
              Campagne
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
        {tab === "sorting" && (
          <Suspense fallback={<TabFallback />}>
            <Sorting />
          </Suspense>
        )}
        {tab === "campagne" && <CampagneTab />}
      </div>
    </div>
  );
}

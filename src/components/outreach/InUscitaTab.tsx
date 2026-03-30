import { lazy, Suspense, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpFromLine, Send } from "lucide-react";
import { CampagneTab } from "./CampagneTab";

const Sorting = lazy(() => import("@/pages/Sorting"));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export function InUscitaTab() {
  const [sub, setSub] = useState("diretti");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-4 pt-2 pb-1">
        <Tabs value={sub} onValueChange={setSub}>
          <TabsList className="bg-muted/40 h-8">
            <TabsTrigger value="diretti" className="gap-1.5 text-xs h-7">
              <ArrowUpFromLine className="w-3 h-3" />
              Invii Diretti
            </TabsTrigger>
            <TabsTrigger value="campagne" className="gap-1.5 text-xs h-7">
              <Send className="w-3 h-3" />
              Campagne
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {sub === "diretti" && (
          <Suspense fallback={<TabFallback />}>
            <Sorting />
          </Suspense>
        )}
        {sub === "campagne" && <CampagneTab />}
      </div>
    </div>
  );
}

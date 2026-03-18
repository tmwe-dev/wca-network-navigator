import { lazy, Suspense, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Users } from "lucide-react";

const Operations = lazy(() => import("./Operations"));
const PartnerHub = lazy(() => import("./PartnerHub"));

function TabFallback() {
  return <div className="h-[calc(100vh-6rem)] animate-pulse bg-muted/20 rounded-lg" />;
}

export default function Network() {
  const [tab, setTab] = useState("download");

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      <div className="flex-shrink-0 border-b border-border bg-background/80 backdrop-blur-sm px-4 pt-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="download" className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" />
              Download WCA
            </TabsTrigger>
            <TabsTrigger value="rubrica" className="gap-1.5 text-xs">
              <Users className="w-3.5 h-3.5" />
              Rubrica Partner
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "download" && (
          <Suspense fallback={<TabFallback />}>
            <Operations />
          </Suspense>
        )}
        {tab === "rubrica" && (
          <Suspense fallback={<TabFallback />}>
            <PartnerHub />
          </Suspense>
        )}
      </div>
    </div>
  );
}

import { lazy, Suspense, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCheck, Building2, Upload } from "lucide-react";

const Contacts = lazy(() => import("./Contacts"));
const ProspectCenter = lazy(() => import("./ProspectCenter"));
const Import = lazy(() => import("./Import"));

function TabFallback() {
  return <div className="h-[calc(100vh-6rem)] animate-pulse bg-muted/20 rounded-lg" />;
}

export default function CRM() {
  const [tab, setTab] = useState("contatti");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-border bg-background/80 backdrop-blur-sm px-4 pt-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="contatti" className="gap-1.5 text-xs">
              <UserCheck className="w-3.5 h-3.5" />
              Contatti
            </TabsTrigger>
            <TabsTrigger value="prospect" className="gap-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5" />
              Prospect
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-1.5 text-xs">
              <Upload className="w-3.5 h-3.5" />
              Import
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "contatti" && (
          <Suspense fallback={<TabFallback />}>
            <Contacts />
          </Suspense>
        )}
        {tab === "prospect" && (
          <Suspense fallback={<TabFallback />}>
            <ProspectCenter />
          </Suspense>
        )}
        {tab === "import" && (
          <Suspense fallback={<TabFallback />}>
            <Import />
          </Suspense>
        )}
      </div>
    </div>
  );
}

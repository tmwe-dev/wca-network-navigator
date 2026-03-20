import { lazy, Suspense, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Rocket, Briefcase, Mail } from "lucide-react";

const Cockpit = lazy(() => import("./Cockpit"));
const Workspace = lazy(() => import("./Workspace"));
const EmailComposer = lazy(() => import("./EmailComposer"));

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
              Cockpit AI
            </TabsTrigger>
            <TabsTrigger value="workspace" className="gap-1.5 text-xs">
              <Briefcase className="w-3.5 h-3.5" />
              Workspace
            </TabsTrigger>
            <TabsTrigger value="composer" className="gap-1.5 text-xs">
              <Mail className="w-3.5 h-3.5" />
              Email Composer
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
        {tab === "workspace" && (
          <Suspense fallback={<TabFallback />}>
            <Workspace />
          </Suspense>
        )}
        {tab === "composer" && (
          <Suspense fallback={<TabFallback />}>
            <EmailComposer />
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

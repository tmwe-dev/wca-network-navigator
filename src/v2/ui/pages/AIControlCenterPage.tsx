/**
 * AIControlCenterPage V2 — AI Control Center with 4 tabs
 */
import * as React from "react";
import { Suspense, lazy } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, ClipboardList, Brain, TrendingUp, Eye } from "lucide-react";

const PendingActionsPanel = lazy(() => import("@/components/ai-control/PendingActionsPanel").then(m => ({ default: m.PendingActionsPanel })));
const DecisionLogPanel = lazy(() => import("@/components/ai-control/DecisionLogPanel").then(m => ({ default: m.DecisionLogPanel })));
const AIPerformancePanel = lazy(() => import("@/components/ai-control/AIPerformancePanel").then(m => ({ default: m.AIPerformancePanel })));
const SupervisorFeedPanel = lazy(() => import("@/components/ai-control/SupervisorFeedPanel").then(m => ({ default: m.SupervisorFeedPanel })));

function TabFallback() {
  return <div className="flex items-center justify-center h-64"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
}

export function AIControlCenterPage(): React.ReactElement {
  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">AI Control Center</h1>
          <p className="text-xs text-muted-foreground">Supervisione decisioni AI, azioni pending e performance</p>
        </div>
      </div>

      <Tabs defaultValue="pending" className="flex-1 flex flex-col">
        <TabsList className="bg-card/80 backdrop-blur-sm border border-border/50">
          <TabsTrigger value="pending" className="gap-1.5 text-xs"><ClipboardList className="h-3.5 w-3.5" />Azioni Pending</TabsTrigger>
          <TabsTrigger value="decisions" className="gap-1.5 text-xs"><Brain className="h-3.5 w-3.5" />Decisioni AI</TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" />Performance</TabsTrigger>
          <TabsTrigger value="supervisor" className="gap-1.5 text-xs"><Eye className="h-3.5 w-3.5" />Supervisore</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="flex-1 mt-4">
          <Suspense fallback={<TabFallback />}><PendingActionsPanel /></Suspense>
        </TabsContent>
        <TabsContent value="decisions" className="flex-1 mt-4">
          <Suspense fallback={<TabFallback />}><DecisionLogPanel /></Suspense>
        </TabsContent>
        <TabsContent value="performance" className="flex-1 mt-4">
          <Suspense fallback={<TabFallback />}><AIPerformancePanel /></Suspense>
        </TabsContent>
        <TabsContent value="supervisor" className="flex-1 mt-4">
          <Suspense fallback={<TabFallback />}><SupervisorFeedPanel /></Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

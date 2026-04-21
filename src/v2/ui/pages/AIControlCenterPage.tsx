/**
 * AIControlCenterPage V2 — AI Control Center with sub-navigation buttons (tmwengine pattern).
 */
import * as React from "react";
import { useState, Suspense, lazy } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Sparkles, Clock, BarChart3, Eye, ListTodo, Bot, Pause, CreditCard, Linkedin } from "lucide-react";

const AIAutomationDashboard = lazy(() => import("@/components/ai-control/AIAutomationDashboard").then(m => ({ default: m.AIAutomationDashboard })));
const PendingActionsPanel = lazy(() => import("@/components/ai-control/PendingActionsPanel").then(m => ({ default: m.PendingActionsPanel })));
const LearningDashboard = lazy(() => import("@/components/ai-control/LearningDashboard").then(m => ({ default: m.LearningDashboard })));
const AIGeneratedActivitiesPanel = lazy(() => import("@/components/ai-control/AIGeneratedActivitiesPanel").then(m => ({ default: m.AIGeneratedActivitiesPanel })));
const SupervisorFeedPanel = lazy(() => import("@/components/ai-control/SupervisorFeedPanel").then(m => ({ default: m.SupervisorFeedPanel })));
const OptimusAgentPanel = lazy(() => import("@/components/ai-control/OptimusAgentPanel").then(m => ({ default: m.OptimusAgentPanel })));
const GlobalAIAutomationPause = lazy(() => import("@/components/ai-control/GlobalAIAutomationPause").then(m => ({ default: m.GlobalAIAutomationPause })));
const CostDashboardWidget = lazy(() => import("@/components/ai-control/CostDashboardWidget").then(m => ({ default: m.CostDashboardWidget })));
const LinkedInLimitsPanel = lazy(() => import("@/components/ai-control/LinkedInLimitsPanel").then(m => ({ default: m.LinkedInLimitsPanel })));

type SubView = "dashboard" | "pending" | "learning" | "ai-activities" | "supervisor" | "optimus" | "controls" | "costs" | "linkedin-limits";

function TabFallback() {
  return <div className="flex items-center justify-center h-64"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
}

export function AIControlCenterPage(): React.ReactElement {
  const [subView, setSubView] = useState<SubView>("dashboard");

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

      {/* Sub-navigation buttons (tmwengine pattern) */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant={subView === "dashboard" ? "default" : "outline"} size="sm" onClick={() => setSubView("dashboard")}>
          <Sparkles className="mr-2 h-4 w-4" /> Dashboard
        </Button>
        <Button variant={subView === "pending" ? "default" : "outline"} size="sm" onClick={() => setSubView("pending")}>
          <Clock className="mr-2 h-4 w-4" /> Pending Actions
        </Button>
        <Button variant={subView === "learning" ? "default" : "outline"} size="sm" onClick={() => setSubView("learning")}>
          <BarChart3 className="mr-2 h-4 w-4" /> Learning Insights
        </Button>
        <Button variant={subView === "ai-activities" ? "default" : "outline"} size="sm" onClick={() => setSubView("ai-activities")}>
          <ListTodo className="mr-2 h-4 w-4" /> AI Activities
        </Button>
        <Button variant={subView === "supervisor" ? "default" : "outline"} size="sm" onClick={() => setSubView("supervisor")}>
          <Eye className="mr-2 h-4 w-4" /> Supervisore
        </Button>
        <Button variant={subView === "optimus" ? "default" : "outline"} size="sm" onClick={() => setSubView("optimus")}>
          <Bot className="mr-2 h-4 w-4" /> Optimus Agent
        </Button>
        <Button variant={subView === "controls" ? "default" : "outline"} size="sm" onClick={() => setSubView("controls")}>
          <Pause className="mr-2 h-4 w-4" /> Pause Control
        </Button>
        <Button variant={subView === "costs" ? "default" : "outline"} size="sm" onClick={() => setSubView("costs")}>
          <CreditCard className="mr-2 h-4 w-4" /> API Costs
        </Button>
        <Button variant={subView === "linkedin-limits" ? "default" : "outline"} size="sm" onClick={() => setSubView("linkedin-limits")}>
          <Linkedin className="mr-2 h-4 w-4" /> LinkedIn Limits
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1">
        <Suspense fallback={<TabFallback />}>
          {subView === "dashboard" && <AIAutomationDashboard />}
          {subView === "pending" && <PendingActionsPanel />}
          {subView === "learning" && <LearningDashboard />}
          {subView === "ai-activities" && <AIGeneratedActivitiesPanel />}
          {subView === "supervisor" && <SupervisorFeedPanel />}
          {subView === "optimus" && <OptimusAgentPanel />}
          {subView === "controls" && <GlobalAIAutomationPause />}
          {subView === "costs" && <CostDashboardWidget />}
          {subView === "linkedin-limits" && <LinkedInLimitsPanel />}
        </Suspense>
      </div>
    </div>
  );
}

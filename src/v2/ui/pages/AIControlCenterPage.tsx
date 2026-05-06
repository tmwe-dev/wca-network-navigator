/**
 * AIControlCenterPage V2 — AI Control Center with sub-navigation buttons (tmwengine pattern).
 */
import * as React from "react";
import { useState, Suspense, lazy } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Sparkles, Clock, BarChart3, Eye, ListTodo, Bot, Pause, CreditCard, Linkedin, Zap } from "lucide-react";
import { PageShell } from "@/v2/ui/templates/PageShell";

const AIAutomationDashboard = lazy(() => import("@/components/ai-control/AIAutomationDashboard").then(m => ({ default: m.AIAutomationDashboard })));
const PendingActionsPanel = lazy(() => import("@/components/ai-control/PendingActionsPanel").then(m => ({ default: m.PendingActionsPanel })));
const LearningDashboard = lazy(() => import("@/components/ai-control/LearningDashboard").then(m => ({ default: m.LearningDashboard })));
const AIGeneratedActivitiesPanel = lazy(() => import("@/components/ai-control/AIGeneratedActivitiesPanel").then(m => ({ default: m.AIGeneratedActivitiesPanel })));
const SupervisorFeedPanel = lazy(() => import("@/components/ai-control/SupervisorFeedPanel").then(m => ({ default: m.SupervisorFeedPanel })));
const OptimusAgentPanel = lazy(() => import("@/components/ai-control/OptimusAgentPanel").then(m => ({ default: m.OptimusAgentPanel })));
const GlobalAIAutomationPause = lazy(() => import("@/components/ai-control/GlobalAIAutomationPause").then(m => ({ default: m.GlobalAIAutomationPause })));
const CostDashboardWidget = lazy(() => import("@/components/ai-control/CostDashboardWidget").then(m => ({ default: m.CostDashboardWidget })));
const LinkedInLimitsPanel = lazy(() => import("@/components/ai-control/LinkedInLimitsPanel").then(m => ({ default: m.LinkedInLimitsPanel })));
const TokenSettingsPanel = lazy(() => import("@/components/ai-control/TokenSettingsPanel").then(m => ({ default: m.TokenSettingsPanel })));

type SubView = "dashboard" | "pending" | "learning" | "ai-activities" | "supervisor" | "optimus" | "controls" | "costs" | "linkedin-limits" | "token-settings";

function TabFallback() {
  return <div className="flex items-center justify-center h-64"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
}

export function AIControlCenterPage(): React.ReactElement {
  const [subView, setSubView] = useState<SubView>("dashboard");

  return (
    <PageShell
      width="wide"
      title={
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> AI Control Center
        </span>
      }
      description="Supervisione decisioni AI, azioni pending e performance"
      toolbar={
        <>
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
        <Button variant={subView === "token-settings" ? "default" : "outline"} size="sm" onClick={() => setSubView("token-settings")}>
          <Zap className="mr-2 h-4 w-4" /> Token Settings
        </Button>
        </>
      }
    >
      {/* Content */}
      <div>
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
          {subView === "token-settings" && <TokenSettingsPanel />}
        </Suspense>
      </div>
    </PageShell>
  );
}

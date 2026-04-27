import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SectionTabs, type SectionTab } from "@/v2/ui/templates/SectionTabs";
import { GoldenHeaderBar } from "@/v2/ui/templates/GoldenHeaderBar";
import { AnalyticsPage } from "@/v2/ui/pages/AnalyticsPage";
import { AgentsPage } from "@/v2/ui/pages/AgentsPage";
import { PromptLabPage } from "@/v2/ui/pages/PromptLabPage";
import { KBSupervisorPage } from "@/v2/ui/pages/KBSupervisorPage";
import { AIControlCenterPage } from "@/v2/ui/pages/AIControlCenterPage";

const TABS: readonly SectionTab[] = [
  { key: "analytics", label: "Analytics",  to: "/v2/intelligence/analytics" },
  { key: "agents",    label: "Agenti",     to: "/v2/intelligence/agents" },
  { key: "prompt",    label: "Prompt Lab", to: "/v2/intelligence/prompt-lab" },
  { key: "kb",        label: "KB",         to: "/v2/intelligence/kb" },
  { key: "control",   label: "Control",    to: "/v2/intelligence/control" },
];

export function IntelligenceSection(): React.ReactElement {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <GoldenHeaderBar />
      <SectionTabs tabs={TABS} rootPath="/v2/intelligence">
        <Routes>
          <Route index element={<Navigate to="/v2/intelligence/analytics" replace />} />
          <Route path="analytics"  element={<AnalyticsPage />} />
          <Route path="agents"     element={<AgentsPage />} />
          <Route path="prompt-lab" element={<PromptLabPage />} />
          <Route path="kb"         element={<KBSupervisorPage />} />
          <Route path="control"    element={<AIControlCenterPage />} />
          <Route path="*"          element={<Navigate to="/v2/intelligence/analytics" replace />} />
        </Routes>
      </SectionTabs>
    </div>
  );
}
export default IntelligenceSection;

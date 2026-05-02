import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SectionTabs, type SectionTab } from "@/v2/ui/templates/SectionTabs";
import { AnalyticsPage } from "@/v2/ui/pages/AnalyticsPage";
import { AgentsPage } from "@/v2/ui/pages/AgentsPage";
import { AIControlCenterPage } from "@/v2/ui/pages/AIControlCenterPage";

const TABS: readonly SectionTab[] = [
  { key: "analytics", label: "Analytics",  to: "/v2/intelligence/analytics" },
  { key: "agents",    label: "Agenti",     to: "/v2/intelligence/agents" },
  { key: "control",   label: "Control",    to: "/v2/intelligence/control" },
];

export function IntelligenceSection(): React.ReactElement {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SectionTabs tabs={TABS} rootPath="/v2/intelligence" contentOverflow="contain">
        <Routes>
          <Route index element={<Navigate to="/v2/intelligence/analytics" replace />} />
          <Route path="analytics"  element={<AnalyticsPage />} />
          <Route path="agents"     element={<AgentsPage />} />
          {/* Prompt Lab & KB Supervisor spostati sotto /v2/settings — solo admin. */}
          <Route path="prompt-lab" element={<Navigate to="/v2/settings/prompt-lab" replace />} />
          <Route path="kb"         element={<Navigate to="/v2/settings/kb" replace />} />
          <Route path="email"      element={<Navigate to="/v2/email-intelligence" replace />} />
          <Route path="control"    element={<AIControlCenterPage />} />
          <Route path="*"          element={<Navigate to="/v2/intelligence/analytics" replace />} />
        </Routes>
      </SectionTabs>
    </div>
  );
}
export default IntelligenceSection;

import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AgentsPage } from "@/v2/ui/pages/AgentsPage";

/**
 * Intelligence section — rinominata "Agenti".
 * Analytics e AI Control sono stati spostati sotto /v2/settings/ai-management.
 * La sezione mostra direttamente la pagina Agenti senza tabs.
 */
export function IntelligenceSection(): React.ReactElement {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Routes>
        <Route index element={<AgentsPage />} />
        <Route path="agents"     element={<AgentsPage />} />
        <Route path="analytics"  element={<Navigate to="/v2/settings/ai-analytics" replace />} />
        <Route path="control"    element={<Navigate to="/v2/settings/ai-control"   replace />} />
        <Route path="prompt-lab" element={<Navigate to="/v2/settings/prompt-lab"   replace />} />
        <Route path="kb"         element={<Navigate to="/v2/settings/kb"           replace />} />
        <Route path="email"      element={<Navigate to="/v2/email-intelligence"    replace />} />
        <Route path="*"          element={<Navigate to="/v2/intelligence/agents"   replace />} />
      </Routes>
    </div>
  );
}
export default IntelligenceSection;

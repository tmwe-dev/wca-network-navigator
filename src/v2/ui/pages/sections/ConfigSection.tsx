import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SectionTabs, type SectionTab } from "@/v2/ui/templates/SectionTabs";
import { SettingsPage } from "@/v2/ui/pages/SettingsPage";
import GuidaPage from "@/v2/ui/pages/GuidaPage";
import { TokenCockpitPage } from "@/v2/ui/pages/TokenCockpitPage";
import { CalendarPage } from "@/v2/ui/pages/CalendarPage";
import { AdminUsersPage } from "@/v2/ui/pages/AdminUsersPage";
import { PromptLabPage } from "@/v2/ui/pages/PromptLabPage";
import { KBSupervisorPage } from "@/v2/ui/pages/KBSupervisorPage";
import { AnalyticsPage } from "@/v2/ui/pages/AnalyticsPage";
import { AIControlCenterPage } from "@/v2/ui/pages/AIControlCenterPage";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { lazy, Suspense } from "react";

const ToolsTab = lazy(() => import("@/components/outreach/ToolsTab").then(m => ({ default: m.ToolsTab })));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

const BASE_TABS: readonly SectionTab[] = [
  { key: "general",  label: "Generali",   to: "/v2/settings/general" },
  { key: "outreach-tools", label: "Strumenti Outreach", to: "/v2/settings/outreach-tools" },
  { key: "ai-analytics",  label: "AI Analytics", to: "/v2/settings/ai-analytics" },
  { key: "ai-control",    label: "AI Control",   to: "/v2/settings/ai-control" },
  { key: "guide",    label: "Guida",      to: "/v2/settings/guide" },
  { key: "token",    label: "Token",      to: "/v2/settings/token" },
  { key: "calendar", label: "Calendario", to: "/v2/settings/calendar" },
  { key: "admin",    label: "Admin",      to: "/v2/settings/admin" },
];

const ADMIN_TABS: readonly SectionTab[] = [
  { key: "prompt-lab", label: "Prompt Lab", to: "/v2/settings/prompt-lab", badge: "ADMIN" },
  { key: "kb",         label: "KB",         to: "/v2/settings/kb",         badge: "ADMIN" },
];

function NotAuthorized(): React.ReactElement {
  return (
    <div className="p-6 text-sm text-muted-foreground">
      Quest'area è riservata agli amministratori.
    </div>
  );
}

export function ConfigSection(): React.ReactElement {
  const { isAdmin } = useAuthV2();
  const tabs = isAdmin ? [...BASE_TABS, ...ADMIN_TABS] : BASE_TABS;
  return (
    <SectionTabs tabs={tabs} rootPath="/v2/settings" contentOverflow="contain">
      <Routes>
        <Route index element={<SettingsPage />} />
        <Route path="general"  element={<SettingsPage />} />
        <Route path="outreach-tools" element={
          <Suspense fallback={<TabFallback />}>
            <ToolsTab />
          </Suspense>
        } />
        <Route path="ai-analytics" element={<AnalyticsPage />} />
        <Route path="ai-control"   element={<AIControlCenterPage />} />
        <Route path="guide"    element={<GuidaPage />} />
        <Route path="token"    element={<TokenCockpitPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="admin"    element={<AdminUsersPage />} />
        <Route path="prompt-lab" element={isAdmin ? <PromptLabPage /> : <NotAuthorized />} />
        <Route path="kb"         element={isAdmin ? <KBSupervisorPage /> : <NotAuthorized />} />
        <Route path="*"        element={<Navigate to="/v2/settings/general" replace />} />
      </Routes>
    </SectionTabs>
  );
}
export default ConfigSection;

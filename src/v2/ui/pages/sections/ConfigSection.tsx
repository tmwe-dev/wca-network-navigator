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
import { useAuthV2 } from "@/v2/hooks/useAuthV2";

const BASE_TABS: readonly SectionTab[] = [
  { key: "general",  label: "Generali",   to: "/v2/settings/general" },
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

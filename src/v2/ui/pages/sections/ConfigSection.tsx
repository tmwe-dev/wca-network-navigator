import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SectionTabs, type SectionTab } from "@/v2/ui/templates/SectionTabs";
import { SettingsPage } from "@/v2/ui/pages/SettingsPage";
import GuidaPage from "@/v2/ui/pages/GuidaPage";
import { TokenCockpitPage } from "@/v2/ui/pages/TokenCockpitPage";
import { CalendarPage } from "@/v2/ui/pages/CalendarPage";
import { AdminUsersPage } from "@/v2/ui/pages/AdminUsersPage";

const TABS: readonly SectionTab[] = [
  { key: "general",  label: "Generali",   to: "/v2/settings/general" },
  { key: "guide",    label: "Guida",      to: "/v2/settings/guide" },
  { key: "token",    label: "Token",      to: "/v2/settings/token" },
  { key: "calendar", label: "Calendario", to: "/v2/settings/calendar" },
  { key: "admin",    label: "Admin",      to: "/v2/settings/admin" },
];

export function ConfigSection(): React.ReactElement {
  return (
    <SectionTabs tabs={TABS} rootPath="/v2/settings">
      <Routes>
        <Route index element={<SettingsPage />} />
        <Route path="general"  element={<SettingsPage />} />
        <Route path="guide"    element={<GuidaPage />} />
        <Route path="token"    element={<TokenCockpitPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="admin"    element={<AdminUsersPage />} />
        <Route path="*"        element={<Navigate to="/v2/settings/general" replace />} />
      </Routes>
    </SectionTabs>
  );
}
export default ConfigSection;

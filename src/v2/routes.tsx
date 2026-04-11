/**
 * Routes v2 — STEP 9 (Complete routing)
 * All modules wired with lazy loading.
 */

import * as React from "react";
import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { AuthenticatedLayout } from "./ui/templates/AuthenticatedLayout";
import { PublicLayout } from "./ui/templates/PublicLayout";

// ── Lazy pages ───────────────────────────────────────────────────────

const LoginPage = lazy(() => import("./ui/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const ResetPasswordPage = lazy(() => import("./ui/pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));
const DashboardPage = lazy(() => import("./ui/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const NetworkPage = lazy(() => import("./ui/pages/NetworkPage").then((m) => ({ default: m.NetworkPage })));
const CRMPage = lazy(() => import("./ui/pages/CRMPage").then((m) => ({ default: m.CRMPage })));
const OutreachPage = lazy(() => import("./ui/pages/OutreachPage").then((m) => ({ default: m.OutreachPage })));
const AgentsPage = lazy(() => import("./ui/pages/AgentsPage").then((m) => ({ default: m.AgentsPage })));
const CampaignsPage = lazy(() => import("./ui/pages/CampaignsPage").then((m) => ({ default: m.CampaignsPage })));
const SettingsPage = lazy(() => import("./ui/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const DiagnosticsPage = lazy(() => import("./ui/pages/DiagnosticsPage").then((m) => ({ default: m.DiagnosticsPage })));
const ImportPage = lazy(() => import("./ui/pages/ImportPage").then((m) => ({ default: m.ImportPage })));

// ── Loading fallback ─────────────────────────────────────────────────

function LoadingFallback(): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

// ── Router ───────────────────────────────────────────────────────────

export function V2Routes(): React.ReactElement {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* Authenticated routes */}
        <Route element={<AuthenticatedLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="network" element={<NetworkPage />} />
          <Route path="crm" element={<CRMPage />} />
          <Route path="outreach" element={<OutreachPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="diagnostics" element={<DiagnosticsPage />} />
          <Route path="import" element={<ImportPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

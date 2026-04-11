/**
 * Routes v2 — STEP 4
 * Routing lazy-loaded separato da v1.
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

// ── Placeholder for future modules ──────────────────────────────────

function PlaceholderPage({ title }: { readonly title: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">In costruzione — STEP 6+</p>
      </div>
    </div>
  );
}

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
          <Route path="network" element={<PlaceholderPage title="Network" />} />
          <Route path="crm" element={<PlaceholderPage title="CRM" />} />
          <Route path="outreach" element={<PlaceholderPage title="Outreach" />} />
          <Route path="agents" element={<PlaceholderPage title="Agenti AI" />} />
          <Route path="campaigns" element={<PlaceholderPage title="Campagne" />} />
          <Route path="diagnostics" element={<PlaceholderPage title="Diagnostica" />} />
          <Route path="settings" element={<PlaceholderPage title="Impostazioni" />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

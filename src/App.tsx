import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";
import { RuntimeDiagnosticPanel } from "@/components/system/RuntimeDiagnosticPanel";
import { ConnectionBanner } from "@/components/system/ConnectionBanner";


// ── New consolidated pages ──
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NetworkPage = lazy(() => import("./pages/Network"));
const CRM = lazy(() => import("./pages/CRM"));
const Outreach = lazy(() => import("./pages/Outreach"));
const Agenda = lazy(() => import("./pages/Agenda"));

// ── Standalone pages ──
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Settings = lazy(() => import("./pages/Settings"));

// ── Legacy pages kept alive for direct access / deep links ──
const Global = lazy(() => import("./pages/Global"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const CampaignJobs = lazy(() => import("./pages/CampaignJobs"));
const TestDownload = lazy(() => import("./pages/TestDownload"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const Guida = lazy(() => import("./pages/Guida"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function PageFallback() {
  return <div className="min-h-screen" />;
}

const App = () => (
  <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ConnectionBanner />
          <RuntimeDiagnosticPanel />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Public routes */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding" element={<Onboarding />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  {/* ── 5 consolidated environments ── */}
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/network" element={<NetworkPage />} />
                  <Route path="/crm" element={<CRM />} />
                  <Route path="/outreach" element={<Outreach />} />
                  <Route path="/agenda" element={<Agenda />} />
                  <Route path="/settings" element={<Settings />} />

                  {/* ── Legacy pages kept alive ── */}
                  <Route path="/global" element={<Global />} />
                  <Route path="/campaigns" element={<Campaigns />} />
                  <Route path="/campaign-jobs" element={<CampaignJobs />} />
                  <Route path="/test-download" element={<TestDownload />} />
                  <Route path="/diagnostics" element={<Diagnostics />} />
                  <Route path="/guida" element={<Guida />} />

                  {/* ── Redirects from old routes to new environments ── */}
                  <Route path="/operations" element={<Navigate to="/network" replace />} />
                  <Route path="/partner-hub" element={<Navigate to="/network" replace />} />
                  <Route path="/contacts" element={<Navigate to="/crm" replace />} />
                  <Route path="/prospects" element={<Navigate to="/crm" replace />} />
                  <Route path="/import" element={<Navigate to="/crm" replace />} />
                  <Route path="/cockpit" element={<Navigate to="/outreach" replace />} />
                  <Route path="/workspace" element={<Navigate to="/outreach" replace />} />
                  <Route path="/email-composer" element={<Navigate to="/outreach" replace />} />
                  <Route path="/sorting" element={<Navigate to="/outreach" replace />} />
                  <Route path="/reminders" element={<Navigate to="/agenda" replace />} />
                  <Route path="/hub" element={<Navigate to="/agenda" replace />} />
                  <Route path="/acquisizione" element={<Navigate to="/network" replace />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </GlobalErrorBoundary>
);

export default App;

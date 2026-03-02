import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";
import { RuntimeDiagnosticPanel } from "@/components/system/RuntimeDiagnosticPanel";
import { ConnectionBanner } from "@/components/system/ConnectionBanner";


// ── Lazy-loaded pages (code-split per route) ──
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Operations = lazy(() => import("./pages/Operations"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const PartnerHub = lazy(() => import("./pages/PartnerHub"));
const Reminders = lazy(() => import("./pages/Reminders"));
const AcquisizionePartner = lazy(() => import("./pages/AcquisizionePartner"));
const Settings = lazy(() => import("./pages/Settings"));
const Guida = lazy(() => import("./pages/Guida"));
const ProspectCenter = lazy(() => import("./pages/ProspectCenter"));
const CampaignJobs = lazy(() => import("./pages/CampaignJobs"));
const EmailComposer = lazy(() => import("./pages/EmailComposer"));
const Workspace = lazy(() => import("./pages/Workspace"));
const Sorting = lazy(() => import("./pages/Sorting"));
const Import = lazy(() => import("./pages/Import"));
const Global = lazy(() => import("./pages/Global"));
const TestDownload = lazy(() => import("./pages/TestDownload"));
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
                  <Route path="/" element={<Operations />} />
                  <Route path="/operations" element={<Operations />} />
                  <Route path="/campaigns" element={<Campaigns />} />
                  <Route path="/acquisizione" element={<AcquisizionePartner />} />
                  <Route path="/reminders" element={<Reminders />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/prospects" element={<ProspectCenter />} />
                  <Route path="/partner-hub" element={<PartnerHub />} />
                  <Route path="/guida" element={<Guida />} />
                  <Route path="/campaign-jobs" element={<CampaignJobs />} />
                  <Route path="/email-composer" element={<EmailComposer />} />
                  <Route path="/workspace" element={<Workspace />} />
                  <Route path="/sorting" element={<Sorting />} />
                  <Route path="/import" element={<Import />} />
                  <Route path="/global" element={<Global />} />
                  <Route path="/test-download" element={<TestDownload />} />
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

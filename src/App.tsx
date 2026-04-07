import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ContactDrawerProvider } from "@/contexts/ContactDrawerContext";
import { ActiveOperatorProvider } from "@/contexts/ActiveOperatorContext";
import { ContactRecordDrawer } from "@/components/contact-drawer/ContactRecordDrawer";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { BackgroundSyncIndicator } from "@/components/BackgroundSyncIndicator";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";
import { RuntimeDiagnosticPanel } from "@/components/system/RuntimeDiagnosticPanel";
import { ConnectionBanner } from "@/components/system/ConnectionBanner";
import { ViteChunkRecovery } from "@/components/system/ViteChunkRecovery";
import { lazyRetry } from "@/lib/lazyRetry";
import { FeatureErrorBoundary } from "@/components/system/FeatureErrorBoundary";

// ── All routes use lazyRetry for automatic chunk recovery ──
const SuperHome3D = lazyRetry(() => import("./pages/SuperHome3D"));
const NetworkPage = lazyRetry(() => import("./pages/Network"));
const CRM = lazyRetry(() => import("./pages/CRM"));
const Outreach = lazyRetry(() => import("./pages/Outreach"));
const Inreach = lazyRetry(() => import("./pages/Inreach"));
const Agenda = lazyRetry(() => import("./pages/Agenda"));
const AgentChatHub = lazyRetry(() => import("./pages/AgentChatHub"));

const RADashboard = lazyRetry(() => import("./pages/RADashboard"));
const RAExplorer = lazyRetry(() => import("./pages/RAExplorer"));
const RAScrapingEngine = lazyRetry(() => import("./pages/RAScrapingEngine"));
const RACompanyDetail = lazyRetry(() => import("./pages/RACompanyDetail"));

// Prefetch high-traffic routes after initial load
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    setTimeout(() => {
      import("./pages/Network");
      import("./pages/Outreach");
      import("./pages/CRM");
    }, 3000);
  }, { once: true });
}

const EmailComposer = lazyRetry(() => import("./pages/EmailComposer"));
const Auth = lazyRetry(() => import("./pages/Auth"));
const Onboarding = lazyRetry(() => import("./pages/Onboarding"));
const Settings = lazyRetry(() => import("./pages/Settings"));
const OperatorsSettings = lazyRetry(() => import("./pages/OperatorsSettings"));

const Campaigns = lazyRetry(() => import("./pages/Campaigns"));
const CampaignJobs = lazyRetry(() => import("./pages/CampaignJobs"));
// Debug/test pages — excluded from production bundle
const TestDownload = lazyRetry(() => import("./pages/TestDownload"));
const TestLinkedInSearch = lazyRetry(() => import("./pages/TestLinkedInSearch"));
const TestExtensions = lazyRetry(() => import("./pages/TestExtensions"));
const Diagnostics = lazyRetry(() => import("./pages/Diagnostics"));
const isDev = import.meta.env.DEV;
const Guida = lazyRetry(() => import("./pages/Guida"));
const AILab = lazyRetry(() => import("./pages/AILab"));
const MissionBuilder = lazyRetry(() => import("./pages/MissionBuilder"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));

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
      <ContactDrawerProvider>
      <ActiveOperatorProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ViteChunkRecovery />
          <BackgroundSyncIndicator />
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
                  <Route path="/" element={<FeatureErrorBoundary feature="Home"><SuperHome3D /></FeatureErrorBoundary>} />
                  <Route path="/network" element={<FeatureErrorBoundary feature="Network"><NetworkPage /></FeatureErrorBoundary>} />
                  <Route path="/crm" element={<FeatureErrorBoundary feature="CRM"><CRM /></FeatureErrorBoundary>} />
                  <Route path="/outreach" element={<FeatureErrorBoundary feature="Outreach"><Outreach /></FeatureErrorBoundary>} />
                  <Route path="/inreach" element={<FeatureErrorBoundary feature="Inreach"><Inreach /></FeatureErrorBoundary>} />
                  <Route path="/agenda" element={<FeatureErrorBoundary feature="Agenda"><Agenda /></FeatureErrorBoundary>} />
                  <Route path="/agent-chat" element={<FeatureErrorBoundary feature="Agent Chat"><AgentChatHub /></FeatureErrorBoundary>} />
                  <Route path="/settings" element={<FeatureErrorBoundary feature="Settings"><Settings /></FeatureErrorBoundary>} />
                  <Route path="/settings/operators" element={<FeatureErrorBoundary feature="Settings"><OperatorsSettings /></FeatureErrorBoundary>} />
                  <Route path="/email-composer" element={<FeatureErrorBoundary feature="Email Composer"><EmailComposer /></FeatureErrorBoundary>} />

                  {/* ── Report Aziende (hidden, from Settings) ── */}
                  <Route path="/ra" element={<FeatureErrorBoundary feature="Report Aziende"><RADashboard /></FeatureErrorBoundary>} />
                  <Route path="/ra/explorer" element={<FeatureErrorBoundary feature="Report Aziende"><RAExplorer /></FeatureErrorBoundary>} />
                  <Route path="/ra/scraping" element={<FeatureErrorBoundary feature="Report Aziende"><RAScrapingEngine /></FeatureErrorBoundary>} />
                  <Route path="/ra/company/:id" element={<FeatureErrorBoundary feature="Report Aziende"><RACompanyDetail /></FeatureErrorBoundary>} />

                  {/* ── Utility pages ── */}
                  <Route path="/campaigns" element={<FeatureErrorBoundary feature="Campaigns"><Campaigns /></FeatureErrorBoundary>} />
                  <Route path="/campaign-jobs" element={<FeatureErrorBoundary feature="Campaigns"><CampaignJobs /></FeatureErrorBoundary>} />
                  {isDev && <>
                    <Route path="/test-download" element={<TestDownload />} />
                    <Route path="/test-linkedin" element={<TestLinkedInSearch />} />
                    <Route path="/test-extensions" element={<TestExtensions />} />
                    <Route path="/diagnostics" element={<Diagnostics />} />
                  </>}
                  <Route path="/guida" element={<Guida />} />
                  <Route path="/ai-lab" element={<FeatureErrorBoundary feature="AI Lab"><AILab /></FeatureErrorBoundary>} />
                  <Route path="/mission-builder" element={<FeatureErrorBoundary feature="Mission Builder"><MissionBuilder /></FeatureErrorBoundary>} />

                  {/* ── Redirects from old routes to new environments ── */}
                  <Route path="/operations" element={<Navigate to="/network" replace />} />
                  <Route path="/partner-hub" element={<Navigate to="/network" replace />} />
                  <Route path="/contacts" element={<Navigate to="/crm" replace />} />
                  <Route path="/prospects" element={<Navigate to="/crm" replace />} />
                  <Route path="/import" element={<Navigate to="/crm" replace />} />
                  <Route path="/cockpit" element={<Navigate to="/outreach" replace />} />
                  <Route path="/workspace" element={<Navigate to="/outreach" replace />} />
                  
                  <Route path="/sorting" element={<Navigate to="/outreach" replace />} />
                  <Route path="/reminders" element={<Navigate to="/agenda" replace />} />
                  <Route path="/hub" element={<Navigate to="/agenda" replace />} />
                  <Route path="/acquisizione" element={<Navigate to="/network" replace />} />
                  <Route path="/dashboard-legacy" element={<Navigate to="/" replace />} />
                  <Route path="/agents" element={<Navigate to="/" replace />} />
                  <Route path="/global" element={<Navigate to="/" replace />} />
                  <Route path="/system-map" element={<Navigate to="/" replace />} />
                  <Route path="/prototype-a" element={<Navigate to="/" replace />} />
                  <Route path="/prototype-b" element={<Navigate to="/" replace />} />
                  <Route path="/prototype-c" element={<Navigate to="/" replace />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <ContactRecordDrawer />
      </TooltipProvider>
      </ActiveOperatorProvider>
      </ContactDrawerProvider>
    </QueryClientProvider>
  </GlobalErrorBoundary>
);

export default App;

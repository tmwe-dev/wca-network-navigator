import { Suspense } from "react";
import { V2Routes } from "@/v2/routes";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ContactDrawerProvider } from "@/contexts/ContactDrawerContext";
const ContactRecordDrawer = lazyRetry(() => import("@/components/contact-drawer/ContactRecordDrawer").then(m => ({ default: m.ContactRecordDrawer })));
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { BackgroundSyncIndicator } from "@/components/BackgroundSyncIndicator";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";
const RuntimeDiagnosticPanel = lazyRetry(() => import("@/components/system/RuntimeDiagnosticPanel").then(m => ({ default: m.RuntimeDiagnosticPanel })));
import { withFeatureBoundary } from "@/components/system/FeatureErrorBoundary";
import { ConnectionBanner } from "@/components/system/ConnectionBanner";
import { ViteChunkRecovery } from "@/components/system/ViteChunkRecovery";
import { lazyRetry } from "@/lib/lazyRetry";
import { AuthProvider } from "@/providers/AuthProvider";
const SuperHome3D = lazyRetry(() => import("./pages/SuperHome3D"));
const Auth = lazyRetry(() => import("./pages/Auth"));
const LauncherHome = lazyRetry(() => import("./pages/LauncherHome"));

// ── All routes use lazyRetry for automatic chunk recovery ──
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
    }, 8000);
  }, { once: true });
}

const EmailComposer = lazyRetry(() => import("./pages/EmailComposer"));
const Onboarding = lazyRetry(() => import("./pages/Onboarding"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const Settings = lazyRetry(() => import("./pages/Settings"));
const OperatorsSettings = lazyRetry(() => import("./pages/OperatorsSettings"));
const AdminUsers = lazyRetry(() => import("./pages/AdminUsers"));

const Campaigns = lazyRetry(() => import("./pages/Campaigns"));
const CampaignJobs = lazyRetry(() => import("./pages/CampaignJobs"));
const TestDownload = lazyRetry(() => import("./pages/TestDownload"));
const TestLinkedInSearch = lazyRetry(() => import("./pages/TestLinkedInSearch"));
const TestExtensions = lazyRetry(() => import("./pages/TestExtensions"));
const Diagnostics = lazyRetry(() => import("./pages/Diagnostics"));
const Guida = lazyRetry(() => import("./pages/Guida"));
const AILab = lazyRetry(() => import("./pages/AILab"));
const MissionBuilder = lazyRetry(() => import("./pages/MissionBuilder"));
const Telemetry = lazyRetry(() => import("./pages/telemetry"));
const StaffDirezionale = lazyRetry(() => import("./pages/StaffDirezionale"));
const AIArena = lazyRetry(() => import("./pages/AIArena").then(m => ({ default: m.AIArenaPage })));
const AIControlCenterPage = lazyRetry(() => import("./v2/ui/pages/AIControlCenterPage").then(m => ({ default: m.AIControlCenterPage })));
const EmailIntelligencePage = lazyRetry(() => import("./v2/ui/pages/EmailIntelligencePage").then(m => ({ default: m.EmailIntelligencePage })));
const NotFound = lazyRetry(() => import("./pages/NotFound"));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>Caricamento applicazione…</span>
      </div>
    </div>
  );
}

const App = () => (
  <GlobalErrorBoundary>
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <ContactDrawerProvider>
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
                  {/* Launcher — no auth */}
                  <Route path="/" element={withFeatureBoundary(<LauncherHome />, "Launcher")} />

                  {/* Public routes */}
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/v1/mission-builder" element={<Navigate to="/v2/missions" replace />} />

                  {/* V1 — Protected routes under /v1 */}
                  <Route path="/v1" element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                      <Route index element={withFeatureBoundary(<SuperHome3D />, "Home")} />
                      <Route path="network" element={withFeatureBoundary(<NetworkPage />, "Network")} />
                      <Route path="crm" element={withFeatureBoundary(<CRM />, "CRM")} />
                      <Route path="outreach" element={withFeatureBoundary(<Outreach />, "Outreach")} />
                      <Route path="inreach" element={withFeatureBoundary(<Inreach />, "Inreach")} />
                      <Route path="agenda" element={withFeatureBoundary(<Agenda />, "Agenda")} />
                      <Route path="agent-chat" element={withFeatureBoundary(<AgentChatHub />, "Agent Chat")} />
                      <Route path="settings" element={withFeatureBoundary(<Settings />, "Settings")} />
                      <Route path="settings/operators" element={withFeatureBoundary(<OperatorsSettings />, "Operators")} />
                      <Route path="settings/users" element={withFeatureBoundary(<AdminUsers />, "Admin Users")} />
                      <Route path="email-composer" element={withFeatureBoundary(<EmailComposer />, "Email Composer")} />
                      <Route path="ra" element={withFeatureBoundary(<RADashboard />, "RA Dashboard")} />
                      <Route path="ra/explorer" element={withFeatureBoundary(<RAExplorer />, "RA Explorer")} />
                      <Route path="ra/scraping" element={withFeatureBoundary(<RAScrapingEngine />, "RA Scraping")} />
                      <Route path="ra/company/:id" element={withFeatureBoundary(<RACompanyDetail />, "RA Company")} />
                      <Route path="campaigns" element={withFeatureBoundary(<Campaigns />, "Campagne")} />
                      <Route path="campaign-jobs" element={withFeatureBoundary(<CampaignJobs />, "Campaign Jobs")} />
                      <Route path="test-download" element={withFeatureBoundary(<TestDownload />, "Test Download")} />
                      <Route path="test-linkedin" element={withFeatureBoundary(<TestLinkedInSearch />, "Test LinkedIn")} />
                      <Route path="test-extensions" element={withFeatureBoundary(<TestExtensions />, "Test Extensions")} />
                      <Route path="diagnostics" element={withFeatureBoundary(<Diagnostics />, "Diagnostics")} />
                      <Route path="guida" element={withFeatureBoundary(<Guida />, "Guida")} />
                      <Route path="ai-lab" element={withFeatureBoundary(<AILab />, "AI Lab")} />
                      <Route path="mission-builder" element={withFeatureBoundary(<MissionBuilder />, "Mission Builder")} />
                      <Route path="telemetry" element={withFeatureBoundary(<Telemetry />, "Telemetry")} />
                      <Route path="staff-direzionale" element={withFeatureBoundary(<StaffDirezionale />, "Staff Direzionale")} />
                      <Route path="ai-arena" element={withFeatureBoundary(<AIArena />, "AI Arena")} />
                      <Route path="ai-control" element={withFeatureBoundary(<AIControlCenterPage />, "AI Control")} />
                      <Route path="email-intelligence" element={withFeatureBoundary(<EmailIntelligencePage />, "Email Intelligence")} />
                      <Route path="operations" element={<Navigate to="network" replace />} />
                      <Route path="contacts" element={<Navigate to="crm" replace />} />
                      <Route path="cockpit" element={<Navigate to="outreach" replace />} />
                      <Route path="reminders" element={<Navigate to="agenda" replace />} />
                    </Route>
                  </Route>

                  {/* V2 routes */}
                  <Route path="/v2/*" element={withFeatureBoundary(<V2Routes />, "V2")} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
            <ContactRecordDrawer />
          </TooltipProvider>
        </ContactDrawerProvider>
      </QueryClientProvider>
    </AuthProvider>
  </GlobalErrorBoundary>
);

export default App;

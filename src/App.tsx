import { Suspense, useMemo } from "react";
import { V2Routes } from "@/v2/routes";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ContactDrawerProvider } from "@/contexts/ContactDrawerContext";
const ContactRecordDrawer = lazyRetry(() => import("@/components/contact-drawer/ContactRecordDrawer").then(m => ({ default: m.ContactRecordDrawer })));
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { BackgroundSyncIndicator } from "@/components/BackgroundSyncIndicator";
import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";
const RuntimeDiagnosticPanel = lazyRetry(() => import("@/components/system/RuntimeDiagnosticPanel").then(m => ({ default: m.RuntimeDiagnosticPanel })));
import { ConnectionBanner } from "@/components/system/ConnectionBanner";
import { ViteChunkRecovery } from "@/components/system/ViteChunkRecovery";
import { lazyRetry } from "@/lib/lazyRetry";
import { AuthProvider } from "@/providers/AuthProvider";
import { FeatureErrorBoundary } from "@/components/system/FeatureErrorBoundary";
const Auth = lazyRetry(() => import("./pages/Auth"));
const Onboarding = lazyRetry(() => import("./pages/Onboarding"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
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

/**
 * V1DeprecationRedirect — Catches any /v1/* URL and redirects to the V2 equivalent.
 * V1 code is preserved in the codebase but no longer accessible via navigation.
 */
const V1_TO_V2_MAP: Record<string, string> = {
  "": "/v2",
  "network": "/v2/network",
  "crm": "/v2/crm",
  "outreach": "/v2/outreach",
  "inreach": "/v2/inreach",
  "agenda": "/v2/agenda",
  "agent-chat": "/v2/agent-chat",
  "settings": "/v2/settings",
  "settings/operators": "/v2/settings",
  "settings/users": "/v2/admin-users",
  "email-composer": "/v2/email-composer",
  "ra": "/v2/research",
  "ra/explorer": "/v2/ra-explorer",
  "ra/scraping": "/v2/ra-scraping",
  "campaigns": "/v2/campaigns",
  "campaign-jobs": "/v2/campaign-jobs",
  "diagnostics": "/v2/diagnostics",
  "guida": "/v2/guida",
  "ai-lab": "/v2/ai-lab",
  "mission-builder": "/v2/missions",
  "telemetry": "/v2/telemetry",
  "staff-direzionale": "/v2/staff",
  "ai-arena": "/v2/ai-arena",
  "ai-control": "/v2/ai-control",
  "email-intelligence": "/v2/email-intelligence",
};

function V1DeprecationRedirect() {
  const location = useLocation();
  const v2Target = useMemo(() => {
    const subPath = location.pathname.replace(/^\/v1\/?/, "").replace(/\/$/, "");
    return V1_TO_V2_MAP[subPath] ?? "/v2";
  }, [location.pathname]);

  return <Navigate to={v2Target + location.search + location.hash} replace />;
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
                  {/* Root → V2 */}
                  <Route path="/" element={<Navigate to="/v2" replace />} />

                  {/* Public routes */}
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/reset-password" element={<ResetPassword />} />

                  {/* V1 DEPRECATED — redirect all /v1/* to /v2/* equivalents */}
                  <Route path="/v1/*" element={<V1DeprecationRedirect />} />

                  {/* V2 routes */}
                  <Route path="/v2/*" element={<FeatureErrorBoundary featureName="V2"><V2Routes /></FeatureErrorBoundary>} />
                  <Route path="*" element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
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

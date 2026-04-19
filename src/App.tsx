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
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { BackgroundSyncIndicator } from "@/components/BackgroundSyncIndicator";
import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";
const RuntimeDiagnosticPanel = lazyRetry(() => import("@/components/system/RuntimeDiagnosticPanel").then(m => ({ default: m.RuntimeDiagnosticPanel })));
import { withFeatureBoundary } from "@/components/system/FeatureErrorBoundary";
import { ConnectionBanner } from "@/components/system/ConnectionBanner";
import { ViteChunkRecovery } from "@/components/system/ViteChunkRecovery";
import { lazyRetry } from "@/lib/lazyRetry";
import { AuthProvider } from "@/providers/AuthProvider";
const Auth = lazyRetry(() => import("./pages/Auth"));
const Onboarding = lazyRetry(() => import("./pages/Onboarding"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));

const LEGACY_V1_REDIRECTS: Record<string, string> = {
  "": "/v2",
  "network": "/v2/network",
  "crm": "/v2/crm",
  "outreach": "/v2/outreach",
  "inreach": "/v2/inreach",
  "agenda": "/v2/outreach/agenda",
  "agent-chat": "/v2/agents",
  "settings": "/v2/settings",
  "settings/operators": "/v2/settings",
  "settings/users": "/v2/settings/admin-users",
  "email-composer": "/v2/outreach/composer",
  "ra": "/v2/research",
  "ra/explorer": "/v2/ra-explorer",
  "ra/scraping": "/v2/ra-scraping",
  "campaigns": "/v2/campaigns",
  "campaign-jobs": "/v2/campaigns/jobs",
  "diagnostics": "/v2/settings/diagnostics",
  "guida": "/v2/guida",
  "ai-lab": "/v2/ai-staff/lab",
  "mission-builder": "/v2/agents/missions",
  "telemetry": "/v2/settings/telemetry",
  "staff-direzionale": "/v2/ai-staff",
  "ai-arena": "/v2/ai-arena",
  "ai-control": "/v2/ai-control",
  "email-intelligence": "/v2/email-intelligence",
  "operations": "/v2/partner-directory",
  "contacts": "/v2/crm/contacts",
  "cockpit": "/v2/outreach",
  "reminders": "/v2/outreach/agenda",
};

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

function resolveLegacyV1Path(pathname: string, search: string, hash: string): string {
  const legacyPath = pathname.replace(/^\/v1\/?/, "");

  if (legacyPath.startsWith("ra/company/")) {
    return `/v2/${legacyPath.replace(/^ra\/company\//, "ra-company/")}${search}${hash}`;
  }

  return `${LEGACY_V1_REDIRECTS[legacyPath] ?? "/v2"}${search}${hash}`;
}

function V1DeprecationRedirect() {
  const location = useLocation();

  return (
    <Navigate
      to={resolveLegacyV1Path(location.pathname, location.search, location.hash)}
      replace
    />
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
                  <Route path="/" element={<Navigate to="/v2" replace />} />

                  {/* Public routes */}
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/reset-password" element={<ResetPassword />} />

                  {/* V1 deprecated — redirect every legacy route to V2 */}
                  <Route path="/v1/*" element={<V1DeprecationRedirect />} />

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

import { Suspense } from "react";
import { V2Routes } from "@/v2/routes";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ContactDrawerProvider } from "@/contexts/ContactDrawerContext";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import { InboundNotificationsProvider } from "@/components/providers/InboundNotificationsProvider";
const ContactRecordDrawer = lazyRetry(() => import("@/components/contact-drawer/ContactRecordDrawer").then(m => ({ default: m.ContactRecordDrawer })));
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { BackgroundSyncIndicator } from "@/components/BackgroundSyncIndicator";
import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";
import { DrawerErrorBoundary } from "@/components/ui/DrawerErrorBoundary";
const RuntimeDiagnosticPanel = lazyRetry(() => import("@/components/system/RuntimeDiagnosticPanel").then(m => ({ default: m.RuntimeDiagnosticPanel })));
import { withFeatureBoundary } from "@/components/system/FeatureErrorBoundary";
import { ConnectionBanner } from "@/components/system/ConnectionBanner";
import { ViteChunkRecovery } from "@/components/system/ViteChunkRecovery";
import { PWAUpdatePrompt } from "@/components/system/PWAUpdatePrompt";
import { lazyRetry } from "@/lib/lazyRetry";
import { AuthProvider } from "@/providers/AuthProvider";
import { TraceConsole } from "@/v2/observability/TraceConsole";
import { traceCollector } from "@/v2/observability/traceCollector";
import { installSupabaseTraceProxy } from "@/v2/observability/supabaseTraceProxy";

// Init observability layer (idempotent, safe before any render)
traceCollector.init();
installSupabaseTraceProxy();

const DEFAULT_HOME_ROUTE = "/v2/partner-hub?country=JO";

function appendLocationParts(target: string, search: string, hash: string): string {
  if (!search) return `${target}${hash}`;
  const joiner = target.includes("?") ? "&" : "?";
  return `${target}${joiner}${search.replace(/^\?/, "")}${hash}`;
}

const LEGACY_V1_REDIRECTS: Record<string, string> = {
  "": DEFAULT_HOME_ROUTE,
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

  return appendLocationParts(LEGACY_V1_REDIRECTS[legacyPath] ?? DEFAULT_HOME_ROUTE, search, hash);
}

function V1DeprecationRedirect() {
  const location = useLocation();

  return (
    <Navigate
      to={resolveLegacyV1Path(location.pathname, location.search, location.hash)}
      state={location.state}
      replace
    />
  );
}

function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={to} state={location.state} replace />;
}

const App = () => (
  <GlobalErrorBoundary>
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <InboundNotificationsProvider>
          <ContactDrawerProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <GlobalFiltersProvider>
                <ViteChunkRecovery />
                <PWAUpdatePrompt />
                <BackgroundSyncIndicator />
                <ConnectionBanner />
                <RuntimeDiagnosticPanel />
                <TraceConsole />
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                  <Route path="/" element={<Navigate to={DEFAULT_HOME_ROUTE} replace />} />

                  {/* Public routes */}
                  <Route path="/auth" element={<LegacyRedirect to="/v2/login" />} />
                  <Route path="/onboarding" element={<LegacyRedirect to="/v2/onboarding" />} />
                  <Route path="/reset-password" element={<LegacyRedirect to="/v2/reset-password" />} />

                  {/* V1 deprecated — redirect every legacy route to V2 */}
                  <Route path="/v1/*" element={<V1DeprecationRedirect />} />

                  {/* V2 routes */}
                  <Route path="/v2/*" element={withFeatureBoundary(<V2Routes />, "V2")} />

                  {/* Legacy bare paths — redirect to V2 equivalents */}
                  <Route path="/email-composer" element={<LegacyRedirect to="/v2/outreach/composer" />} />
                  <Route path="/network" element={<LegacyRedirect to="/v2/network" />} />
                  <Route path="/crm" element={<LegacyRedirect to="/v2/crm" />} />
                  <Route path="/outreach" element={<LegacyRedirect to="/v2/outreach" />} />
                  <Route path="/inreach" element={<LegacyRedirect to="/v2/inreach" />} />
                  <Route path="/agenda" element={<LegacyRedirect to="/v2/outreach/agenda" />} />
                  <Route path="/campaigns" element={<LegacyRedirect to="/v2/campaigns" />} />
                  <Route path="/settings" element={<LegacyRedirect to="/v2/settings" />} />
                  <Route path="/ai-staff" element={<LegacyRedirect to="/v2/ai-staff" />} />
                  <Route path="/ai-staff/email-forge" element={<LegacyRedirect to="/v2/ai-staff/email-forge" />} />
                  <Route path="/email-forge" element={<LegacyRedirect to="/v2/ai-staff/email-forge" />} />

                  <Route path="*" element={<Navigate to={DEFAULT_HOME_ROUTE} replace />} />
                </Routes>
              </Suspense>
              </GlobalFiltersProvider>
            </BrowserRouter>
            <DrawerErrorBoundary scope="ContactRecordDrawer">
              <ContactRecordDrawer />
            </DrawerErrorBoundary>
          </TooltipProvider>
          </ContactDrawerProvider>
        </InboundNotificationsProvider>
      </QueryClientProvider>
    </AuthProvider>
  </GlobalErrorBoundary>
);

export default App;

/**
 * AuthenticatedLayout — Orchestrator using sub-components
 * Provides ALL providers, background hooks, and global overlays
 */
import * as React from "react";
import { useEffect, useState, Suspense, useRef } from "react";
import { lazyRetry } from "@/lib/lazyRetry";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";
import { Target } from "lucide-react";
import { Toaster as SonnerToaster, toast } from "sonner";
import { ClaudeBadge } from "@/components/system/ClaudeBadge";
import { Toaster } from "@/components/ui/toaster";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { BlacklistStaleBanner } from "@/components/shared/BlacklistStaleBanner";
import { LiveRegion } from "@/components/shared/LiveRegion";
import { useLiveAnnounce } from "@/hooks/useLiveAnnounce";
import { useAiBridgeListener } from "@/hooks/useAiBridgeListener";
import { DrawerErrorBoundary } from "@/components/ui/DrawerErrorBoundary";


import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActiveOperatorProvider } from "@/contexts/ActiveOperatorContext";
import { ActiveMailboxProvider } from "@/contexts/ActiveMailboxContext";
import { DeepSearchContext, useDeepSearchRunner } from "@/hooks/useDeepSearchRunner";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import { MissionProvider } from "@/contexts/MissionContext";

import { useWcaSession } from "@/hooks/useWcaSession";
import { BackgroundServices } from "./BackgroundServices";

import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";
import { ContextFiltersRail } from "./ContextFiltersRail";
import { GlobalNavTrigger } from "./GlobalNavTrigger";
import { queryKeys } from "@/lib/queryKeys";
import { scheduleIdlePrefetch } from "@/lib/prefetchRoutes";
import { BcaFiltersProvider } from "@/components/contacts/bca/BcaFiltersContext";
import { ComposeAiConfigProvider } from "@/contexts/ComposeAiConfigContext";

const ContactRecordDrawer = lazyRetry(() => import("@/components/contact-drawer/ContactRecordDrawer").then(m => ({ default: m.ContactRecordDrawer })));
const MissionDrawer = lazyRetry(() => import("@/components/global/MissionDrawer").then(m => ({ default: m.MissionDrawer })));
const FiltersDrawer = lazyRetry(() => import("@/components/global/filters-drawer").then(m => ({ default: m.FiltersDrawer })));
const IntelliFlowOverlay = lazyRetry(() => import("@/components/intelliflow/IntelliFlowOverlay"));
const CommandPalette = lazyRetry(() => import("@/components/CommandPalette").then(m => ({ default: m.CommandPalette })));
const GlobalVoiceFAB = lazyRetry(() => import("@/components/voice/GlobalVoiceFAB"));
const FloatingCoPilot = lazyRetry(() => import("@/v2/ui/copilot/FloatingCoPilot").then(m => ({ default: m.FloatingCoPilot })));
import { CoPilotProvider } from "@/v2/ui/copilot/CoPilotContext";
const AddContactDialog = lazyRetry(() => import("@/components/contacts/AddContactDialog").then(m => ({ default: m.AddContactDialog })));
const AgentOperationsDashboard = lazyRetry(() => import("@/components/agents/AgentOperationsDashboard").then(m => ({ default: m.AgentOperationsDashboard })));
const TestExtensionsContent = lazyRetry(() => import("@/components/test-extensions/TestExtensionsView"));
const OnboardingWizard = lazyRetry(() => import("@/components/onboarding/OnboardingWizard").then(m => ({ default: m.OnboardingWizard })));
const MobileBottomNav = lazyRetry(() => import("@/components/mobile/MobileBottomNav").then(m => ({ default: m.MobileBottomNav })));
const PWAInstallPrompt = lazyRetry(() => import("@/components/shared/PWAInstallPrompt").then(m => ({ default: m.PWAInstallPrompt })));
const NotificationsProvider = lazyRetry(() => import("@/components/notifications/NotificationsProvider").then(m => ({ default: m.NotificationsProvider })));

export function AuthenticatedLayout(): React.ReactElement | null {
  const { isAuthenticated, isLoading } = useAuthV2();
  const navigate = useNavigate();
  const location = useLocation();

  useAiBridgeListener();


  useEffect(() => {
    const segment = location.pathname.replace("/v2", "").replace(/^\//, "") || "dashboard";
    const title = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
    document.title = `${title} — WCA Partners`;
    setSidebarOpen(false);
  }, [location.pathname]);

  // Session readiness sourced from centralized AuthProvider
  const { status: authStatus } = useAuth();
  const sessionReady = authStatus === "authenticated";

  // ⚡ Perf: invalidate cache only on sign-in transition (not on every sessionReady toggle).
  // Old behavior re-fetched ~30 queries on every navigation.
  const prevSessionReady = useRef(false);
  useEffect(() => {
    if (sessionReady && !prevSessionReady.current) {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.completed });
    }
    prevSessionReady.current = sessionReady;
  }, [sessionReady]);

  const [commandOpen, setCommandOpen] = useState(false);
  const [intelliflowOpen, setIntelliflowOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [agentDashOpen, setAgentDashOpen] = useState(false);
  const [testExtOpen, setTestExtOpen] = useState(false);


  const deepSearch = useDeepSearchRunner();

  // Onboarding check — source of truth is profiles.onboarding_completed
  const { data: onboardingDone, isLoading: onboardingLoading } = useQuery({
    queryKey: queryKeys.onboarding.completed,
    queryFn: async () => {
      // Use getSession() (local, 0ms) instead of getUser() (network, ~200ms)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return true;
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", session.user.id)
        .maybeSingle();
      // If no profile row or null, treat as completed (existing user safety)
      return data?.onboarding_completed !== false;
    },
    staleTime: Infinity,
    enabled: isAuthenticated && sessionReady,
  });

  // ⚡ Perf: hook critici per UI (sessione WCA) montati subito.
  // Hook background (useJobHealthMonitor, useWcaSync, useOutreachQueue,
  // useGlobalAutoSync, useOptimusBridgeListener, useAiExtractBridgeListener)
  // sono spostati in <BackgroundServices> e avviati su requestIdleCallback
  // dopo first paint per non bloccare il TTI.
  const wcaSession = useWcaSession();

  // Prefetch top routes during idle so navigation is instant.
  useEffect(() => { scheduleIdlePrefetch(); }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/auth", { replace: true });
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setCommandOpen(o => !o); }
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setIntelliflowOpen(o => !o); }
      // Mission Control: Cmd/Ctrl+M
      if (e.key === "m" && (e.metaKey || e.ctrlKey) && !e.shiftKey) { e.preventDefault(); setMissionOpen(o => !o); }
      // Filters Drawer: Cmd/Ctrl+Shift+F
      if (e.key === "F" && (e.metaKey || e.ctrlKey) && e.shiftKey) { e.preventDefault(); setFiltersOpen(o => !o); }
    };
    const drawerHandler = (e: Event) => {
      const d = (e as CustomEvent).detail?.drawer;
      if (d === "mission") setMissionOpen(true);
      else if (d === "filters") setFiltersOpen(true);
    };
    document.addEventListener("keydown", down);
    window.addEventListener("open-drawer", drawerHandler);
    return () => { document.removeEventListener("keydown", down); window.removeEventListener("open-drawer", drawerHandler); };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      switch (detail.action_type) {
        case "navigate":
          if (detail.path) navigate(detail.path.startsWith("/v2") ? detail.path : "/v2" + detail.path);
          break;
        case "show_toast":
          toast[detail.toast_type === "error" ? "error" : "success"](detail.message || "");
          break;
        case "apply_filters":
          window.dispatchEvent(new CustomEvent("ai-command", { detail: { filters: detail.filters } }));
          break;
        case "open_modal": {
          // Inoltrato al CoPilotContext via custom event interno
          window.dispatchEvent(new CustomEvent("copilot-open-modal", {
            detail: { name: detail.modal, params: detail.params || {} },
          }));
          break;
        }
        case "start_download_job":
          if (detail.job_id) {
            toast.success(`Job ${detail.job_id.slice(0, 8)}… pronto. Vai su Network per avviarlo.`);
            navigate("/v2/network");
          }
          break;
      }
    };
    window.addEventListener("ai-ui-action", handler);
    return () => window.removeEventListener("ai-ui-action", handler);
  }, [navigate]);

  // ⚠️ Nessun listener globale wheel/preventDefault: blocca il trackpad e
  // rompe gli scroll annidati di tutta l'app. La protezione contro lo
  // swipe-back orizzontale del browser è gestita dal CSS
  // `overscroll-behavior-x: none` su html/body in src/index.css.

  if (isLoading || !sessionReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // Show onboarding wizard if not completed
  if (!onboardingLoading && onboardingDone === false) {
    return (
      <GlobalErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={null}>
            <OnboardingWizard onComplete={() => queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.completed })} />
          </Suspense>
        </QueryClientProvider>
      </GlobalErrorBoundary>
    );
  }

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ActiveOperatorProvider>
          <ActiveMailboxProvider>
            <DeepSearchContext.Provider value={deepSearch}>
              <GlobalFiltersProvider>
                <MissionProvider>
                  <NotificationsProvider>
                  <CoPilotProvider>
                      <SonnerToaster position="top-right" richColors closeButton />
                      <Toaster />
                      <LiveRegion message="" />

                    <ComposeAiConfigProvider>
                    <div className="flex h-screen overflow-hidden overscroll-x-none bg-background">
                      {/* ComposeAiConfigProvider wraps both main content AND overlays (FiltersDrawer)
                          so EmailComposeFiltersSection works in either place. */}
                      {/* Skip navigation link for accessibility */}
                      <a
                        href="#main-content"
                        data-testid="skip-nav"
                        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium"
                      >
                        Vai al contenuto principale
                      </a>
                      {/* Unico menu globale: pulsante fluttuante ☰ Menu in alto a sinistra. */}
                      <GlobalNavTrigger />

                      {/* Linguetta filtri rimossa: usiamo solo quella contestuale di ContextFiltersRail */}
                      <button
                        onClick={() => setMissionOpen(true)}
                        className={cn(
                          "hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-[60] items-center justify-center w-6 h-12 rounded-l-lg border border-l-0 border-primary/30 hover:border-primary/50 transition-all cursor-pointer",
                          missionOpen && "opacity-0 pointer-events-none"
                        )}
                        style={{ background: "hsl(var(--primary) / 0.25)", backdropFilter: "blur(8px)" }}
                        aria-label="Apri Mission"
                      >
                        <Target className="w-3 h-3 text-primary" />
                      </button>

                      {/* Main content */}
                      <BcaFiltersGate>
                      <div className="flex-1 flex overflow-hidden">
                        <ContextFiltersRail />
                        <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
                        <OfflineBanner />
                        <BlacklistStaleBanner />
                        <BackgroundServices>{() => null}</BackgroundServices>
                        <main id="main-content" tabIndex={-1} role="main" className="flex-1 overflow-y-auto overscroll-x-none pb-16 md:pb-0">
                          {/* ⚡ Perf: rimosso AnimatePresence mode="wait" che bloccava il mount fino a fine animazione exit (-150-300ms per nav). */}
                          <div className="h-full animate-in fade-in duration-150">
                            <Outlet />
                          </div>
                        </main>
                        <Suspense fallback={null}><MobileBottomNav /></Suspense>
                        <Suspense fallback={null}><PWAInstallPrompt /></Suspense>
                        </div>
                      </div>
                      </BcaFiltersGate>
                    </div>

                    {/* Overlays */}
                    <Suspense fallback={null}><CommandPalette open={commandOpen} onOpenChange={setCommandOpen} /></Suspense>
                    <Suspense fallback={null}><MissionDrawer open={missionOpen} onOpenChange={setMissionOpen} /></Suspense>
                    <Suspense fallback={null}><FiltersDrawer open={filtersOpen} onOpenChange={setFiltersOpen} /></Suspense>
                    {intelliflowOpen && <Suspense fallback={null}><IntelliFlowOverlay open={intelliflowOpen} onClose={() => setIntelliflowOpen(false)} /></Suspense>}
                    {addContactOpen && <Suspense fallback={null}><AddContactDialog open={addContactOpen} onOpenChange={setAddContactOpen} /></Suspense>}
                    {agentDashOpen && <Suspense fallback={null}><AgentOperationsDashboard open={agentDashOpen} onOpenChange={setAgentDashOpen} /></Suspense>}
                    {testExtOpen && (
                      <Dialog open={testExtOpen} onOpenChange={setTestExtOpen}>
                        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                          <DialogHeader><DialogTitle>🧪 Test Estensioni</DialogTitle></DialogHeader>
                          <DialogDescription className="sr-only">Pannello per testare le estensioni browser</DialogDescription>
                          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Caricamento...</div>}>
                            <TestExtensionsContent />
                          </Suspense>
                        </DialogContent>
                      </Dialog>
                    )}

                      <Suspense fallback={null}>
                        <DrawerErrorBoundary scope="ContactRecordDrawer">
                          <ContactRecordDrawer />
                        </DrawerErrorBoundary>
                      </Suspense>
                      <ClaudeBadge />
                      {/* GlobalVoiceFAB removed — voice controls moved to LayoutHeader */}
                      <Suspense fallback={null}>
                        <FloatingCoPilot />
                      </Suspense>
                    </ComposeAiConfigProvider>
                  </CoPilotProvider>
                    </NotificationsProvider>
                  </MissionProvider>
                </GlobalFiltersProvider>
              </DeepSearchContext.Provider>
          </ActiveMailboxProvider>
          </ActiveOperatorProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}

/**
 * BcaFiltersGate — monta il `BcaFiltersProvider` solo nelle route in cui la
 * maschera Biglietti è visibile (CRM › Biglietti, Network › BCA), così la
 * linguetta globale `ContextFiltersRail` può accedere allo stesso stato
 * filtri usato dalla pagina.
 */
function BcaFiltersGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isBca =
    pathname.startsWith("/v2/pipeline/biglietti") ||
    pathname.startsWith("/v2/explore/biglietti") ||
    pathname.startsWith("/v2/explore/network") ||
    pathname === "/v2/network";
  if (!isBca) return <>{children}</>;
  return <BcaFiltersProvider>{children}</BcaFiltersProvider>;
}

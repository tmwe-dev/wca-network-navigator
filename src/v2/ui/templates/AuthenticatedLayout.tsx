/**
 * AuthenticatedLayout — Orchestrator using sub-components
 * Provides ALL providers, background hooks, and global overlays
 */
import * as React from "react";
import { useEffect, useState, lazy, Suspense, useRef } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { X, Menu, Sparkles, SlidersHorizontal, Target } from "lucide-react";
import { Button } from "../atoms/Button";
import { Toaster as SonnerToaster, toast } from "sonner";
import { ClaudeBadge } from "@/components/system/ClaudeBadge";
import { Toaster } from "@/components/ui/toaster";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActiveOperatorProvider } from "@/contexts/ActiveOperatorContext";
import { ContactDrawerProvider } from "@/contexts/ContactDrawerContext";
import { DeepSearchContext, useDeepSearchRunner } from "@/hooks/useDeepSearchRunner";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import { MissionProvider } from "@/contexts/MissionContext";

import { useJobHealthMonitor } from "@/hooks/useJobHealthMonitor";
import { useWcaSync } from "@/hooks/useWcaSync";
import { useOutreachQueue } from "@/hooks/useOutreachQueue";
import { useGlobalAutoSync } from "@/hooks/useGlobalAutoSync";
import { useWcaSession } from "@/hooks/useWcaSession";

import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";
import { LayoutSidebarNav } from "./LayoutSidebarNav";
import { LayoutHeader } from "./LayoutHeader";

const ContactRecordDrawer = lazy(() => import("@/components/contact-drawer/ContactRecordDrawer").then(m => ({ default: m.ContactRecordDrawer })));
const MissionDrawer = lazy(() => import("@/components/global/MissionDrawer").then(m => ({ default: m.MissionDrawer })));
const FiltersDrawer = lazy(() => import("@/components/global/FiltersDrawer").then(m => ({ default: m.FiltersDrawer })));
const IntelliFlowOverlay = lazy(() => import("@/components/intelliflow/IntelliFlowOverlay"));
const CommandPalette = lazy(() => import("@/components/CommandPalette").then(m => ({ default: m.CommandPalette })));
const GlobalVoiceFAB = lazy(() => import("@/components/voice/GlobalVoiceFAB"));
const AddContactDialog = lazy(() => import("@/components/contacts/AddContactDialog").then(m => ({ default: m.AddContactDialog })));
const AgentOperationsDashboard = lazy(() => import("@/components/agents/AgentOperationsDashboard").then(m => ({ default: m.AgentOperationsDashboard })));
const TestExtensionsContent = lazy(() => import("@/pages/TestExtensions"));

export function AuthenticatedLayout(): React.ReactElement | null {
  const { isAuthenticated, isLoading, profile, signOut } = useAuthV2();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const segment = location.pathname.replace("/v2", "").replace(/^\//, "") || "dashboard";
    const title = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
    document.title = `${title} — WCA Partners`;
    setSidebarOpen(false);
  }, [location.pathname]);

  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    let sub: { unsubscribe: () => void } | null = null;
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session) { setSessionReady(true); }
      else {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
          if (s && mounted) setSessionReady(true);
        });
        sub = subscription;
      }
    };
    check();
    return () => { mounted = false; sub?.unsubscribe(); };
  }, []);

  useEffect(() => { if (sessionReady) queryClient.invalidateQueries(); }, [sessionReady]);

  const [commandOpen, setCommandOpen] = useState(false);
  const [intelliflowOpen, setIntelliflowOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [agentDashOpen, setAgentDashOpen] = useState(false);
  const [testExtOpen, setTestExtOpen] = useState(false);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("dl_theme", next ? "dark" : "light");
  };

  const deepSearch = useDeepSearchRunner();

  useJobHealthMonitor();
  useWcaSync();
  const outreachQueue = useOutreachQueue();
  const globalSync = useGlobalAutoSync();
  const wcaSession = useWcaSession();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/v2/login", { replace: true });
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setCommandOpen(o => !o); }
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setIntelliflowOpen(o => !o); }
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

  const hoverTimerLeft = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTimerRight = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleEdgeEnter = (side: "left" | "right") => {
    const timer = setTimeout(() => {
      if (side === "left") setFiltersOpen(true); else setMissionOpen(true);
    }, 150);
    if (side === "left") hoverTimerLeft.current = timer; else hoverTimerRight.current = timer;
  };
  const handleEdgeLeave = (side: "left" | "right") => {
    const t = side === "left" ? hoverTimerLeft.current : hoverTimerRight.current;
    if (t) clearTimeout(t);
  };

  if (isLoading || !sessionReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const wcaStatusColor = wcaSession.sessionActive === true ? "text-emerald-400" : wcaSession.isChecking ? "text-primary animate-pulse" : "text-muted-foreground";
  const wcaStatusLabel = wcaSession.sessionActive === true ? "WCA Online" : wcaSession.isChecking ? "Verifica…" : wcaSession.sessionActive === false ? "WCA Offline" : "WCA";

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ActiveOperatorProvider>
            <ContactDrawerProvider>
              <DeepSearchContext.Provider value={deepSearch}>
                <GlobalFiltersProvider>
                  <MissionProvider>
                    <SonnerToaster position="top-right" richColors closeButton />
                    <Toaster />

                    <div className="flex h-screen bg-background">
                      {/* Desktop sidebar */}
                      <div
                        className={`hidden md:block fixed left-0 top-0 z-50 h-full transition-transform duration-200 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
                        onMouseLeave={() => setSidebarOpen(false)}
                      >
                        <div className="w-56 h-full flex flex-col border-r border-border/40 bg-card/80 backdrop-blur-xl">
                          <LayoutSidebarNav
                            profileName={profile?.displayName}
                            wcaStatusColor={wcaStatusColor}
                            wcaStatusLabel={wcaStatusLabel}
                            wcaSessionActive={wcaSession.sessionActive}
                            onWcaReconnect={() => wcaSession.ensureSession()}
                            isDark={isDark}
                            onToggleTheme={toggleTheme}
                            onSignOut={signOut}
                          />
                        </div>
                      </div>

                      {/* Mobile header */}
                      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b px-4 py-2 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-foreground">WCA Partners</h2>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setIntelliflowOpen(true)} className="p-1"><Sparkles className="h-4 w-4 text-primary" /></button>
                          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1">
                            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>

                      {mobileOpen ? (
                        <div className="md:hidden fixed inset-0 z-40 flex">
                          <div className="w-64 bg-card border-r flex flex-col mt-12">
                            <LayoutSidebarNav
                              profileName={profile?.displayName}
                              wcaStatusColor={wcaStatusColor}
                              wcaStatusLabel={wcaStatusLabel}
                              wcaSessionActive={wcaSession.sessionActive}
                              onWcaReconnect={() => wcaSession.ensureSession()}
                              isDark={isDark}
                              onToggleTheme={toggleTheme}
                              onSignOut={signOut}
                              onMobileClose={() => setMobileOpen(false)}
                            />
                          </div>
                          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
                        </div>
                      ) : null}

                      {/* Edge hover triggers */}
                      <button
                        onClick={() => setFiltersOpen(true)}
                        onMouseEnter={() => handleEdgeEnter("left")}
                        onMouseLeave={() => handleEdgeLeave("left")}
                        className={cn(
                          `hidden md:flex fixed ${sidebarOpen ? "left-56" : "left-0"} top-1/2 -translate-y-1/2 z-[60] items-center justify-center w-6 h-12 rounded-r-lg border border-l-0 border-primary/30 hover:border-primary/50 transition-all cursor-pointer`,
                          filtersOpen && "opacity-0 pointer-events-none"
                        )}
                        style={{ background: "hsl(var(--primary) / 0.25)", backdropFilter: "blur(8px)" }}
                        aria-label="Apri filtri"
                      >
                        <SlidersHorizontal className="w-3 h-3 text-primary" />
                      </button>
                      <button
                        onClick={() => setMissionOpen(true)}
                        onMouseEnter={() => handleEdgeEnter("right")}
                        onMouseLeave={() => handleEdgeLeave("right")}
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
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <LayoutHeader
                          onToggleSidebar={() => setSidebarOpen(o => !o)}
                          onAiClick={() => setIntelliflowOpen(true)}
                          onAddContact={() => setAddContactOpen(true)}
                          onAgentDash={() => setAgentDashOpen(true)}
                          onTestExt={() => setTestExtOpen(true)}
                          outreachQueue={outreachQueue}
                          globalSync={globalSync}
                        />
                        <main className="flex-1 overflow-y-auto md:mt-0 mt-12"><Outlet /></main>
                      </div>
                    </div>

                    {/* Overlays */}
                    {commandOpen && <Suspense fallback={null}><CommandPalette open={commandOpen} onOpenChange={setCommandOpen} /></Suspense>}
                    {missionOpen && <Suspense fallback={null}><MissionDrawer open={missionOpen} onOpenChange={setMissionOpen} /></Suspense>}
                    {filtersOpen && <Suspense fallback={null}><FiltersDrawer open={filtersOpen} onOpenChange={setFiltersOpen} /></Suspense>}
                    {intelliflowOpen && <Suspense fallback={null}><IntelliFlowOverlay open={intelliflowOpen} onClose={() => setIntelliflowOpen(false)} /></Suspense>}
                    {addContactOpen && <Suspense fallback={null}><AddContactDialog open={addContactOpen} onOpenChange={setAddContactOpen} /></Suspense>}
                    {agentDashOpen && <Suspense fallback={null}><AgentOperationsDashboard open={agentDashOpen} onOpenChange={setAgentDashOpen} /></Suspense>}
                    {testExtOpen && (
                      <Dialog open={testExtOpen} onOpenChange={setTestExtOpen}>
                        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                          <DialogHeader><DialogTitle>🧪 Test Estensioni</DialogTitle></DialogHeader>
                          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Caricamento...</div>}>
                            <TestExtensionsContent />
                          </Suspense>
                        </DialogContent>
                      </Dialog>
                    )}

                    <Suspense fallback={null}><ContactRecordDrawer /></Suspense>
                    <ClaudeBadge />
                    <Suspense fallback={null}><GlobalVoiceFAB /></Suspense>
                  </MissionProvider>
                </GlobalFiltersProvider>
              </DeepSearchContext.Provider>
            </ContactDrawerProvider>
          </ActiveOperatorProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}

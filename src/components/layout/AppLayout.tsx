import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";

import { ActiveProcessIndicator } from "./ActiveProcessIndicator";
import { Menu, Sparkles, Target, SlidersHorizontal, Globe, Users, ArrowRight, Plus, FlaskConical, DatabaseZap, Activity, Mic, MicOff } from "lucide-react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClaudeBadge } from "@/components/system/ClaudeBadge";
import { useDeepSearchRunner, DeepSearchContext } from "@/hooks/useDeepSearchRunner";
import { ConnectionStatusBar } from "./ConnectionStatusBar";
import { OperatorSelector } from "@/components/header/OperatorSelector";
import { useJobHealthMonitor } from "@/hooks/useJobHealthMonitor";
import { useWcaSync } from "@/hooks/useWcaSync";
import { useOutreachQueue } from "@/hooks/useOutreachQueue";
import { useGlobalAutoSync } from "@/hooks/useGlobalAutoSync";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { MissionProvider } from "@/contexts/MissionContext";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const IntelliFlowOverlay = lazy(() => import("@/components/intelliflow/IntelliFlowOverlay"));
const TestExtensionsContent = lazy(() => import("@/pages/TestExtensions").then((m) => ({ default: m.TestExtensionsContent })));
const CommandPalette = lazy(() => import("@/components/CommandPalette").then((m) => ({ default: m.CommandPalette })));
const MissionDrawer = lazy(() => import("@/components/global/MissionDrawer").then((m) => ({ default: m.MissionDrawer })));
const FiltersDrawer = lazy(() => import("@/components/global/FiltersDrawer").then((m) => ({ default: m.FiltersDrawer })));
const AddContactDialog = lazy(() => import("@/components/contacts/AddContactDialog").then((m) => ({ default: m.AddContactDialog })));
const AgentOperationsDashboard = lazy(() => import("@/components/agents/AgentOperationsDashboard").then((m) => ({ default: m.AgentOperationsDashboard })));

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [intelliflowOpen, setIntelliflowOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [testExtOpen, setTestExtOpen] = useState(false);
  const [agentDashOpen, setAgentDashOpen] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const deepSearch = useDeepSearchRunner();
  const outreachQueue = useOutreachQueue();
  useJobHealthMonitor();
  useWcaSync();
  const globalSync = useGlobalAutoSync();

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const currentPath = location.pathname;
  const isFullscreenRoute = ["/", "/network", "/crm", "/outreach", "/agenda", "/operations", "/global", "/reminders", "/settings", "/import", "/hub-operativo", "/email-composer"].includes(currentPath);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setCommandOpen((o) => !o); }
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setIntelliflowOpen((o) => !o); }
      if (e.key === "n" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); navigate("/v1/email-composer"); }
      if (e.key === "m" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); navigate("/v1/mission-builder"); }
      if (e.key === "Escape") { setCommandOpen(false); setIntelliflowOpen(false); setMissionOpen(false); setFiltersOpen(false); }
    };
    const drawerHandler = (e: Event) => {
      const d = (e as CustomEvent).detail?.drawer;
      if (d === "mission") setMissionOpen(true);
      else if (d === "filters") setFiltersOpen(true);
    };
    document.addEventListener("keydown", down);
    window.addEventListener("open-drawer", drawerHandler);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("open-drawer", drawerHandler);
    };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      switch (detail.action_type) {
        case "navigate":
          if (detail.path) navigate(detail.path);
          break;
        case "show_toast":
          toast({ title: detail.toast_type === "error" ? "⚠️ Errore" : "✅ Fatto", description: detail.message || "" });
          break;
        case "apply_filters":
          window.dispatchEvent(new CustomEvent("ai-command", { detail: { filters: detail.filters } }));
          break;
        case "start_download_job":
          if (detail.job_id) {
            toast({ title: "🤖 Job creato dall'agente", description: `Job ${detail.job_id.slice(0, 8)}… pronto. Vai su Network per avviarlo.` });
            navigate("/v1/network");
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
      if (side === "left") setFiltersOpen(true);
      else setMissionOpen(true);
    }, 150);
    if (side === "left") hoverTimerLeft.current = timer;
    else hoverTimerRight.current = timer;
  };

  const handleEdgeLeave = (side: "left" | "right") => {
    const t = side === "left" ? hoverTimerLeft.current : hoverTimerRight.current;
    if (t) clearTimeout(t);
  };

  return (
    <DeepSearchContext.Provider value={deepSearch}>
      <MissionProvider>
        <GlobalFiltersProvider>
          <div className="flex h-screen w-full bg-background overflow-hidden overscroll-none" onClick={() => sidebarOpen && setSidebarOpen(false)} onWheel={(e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.preventDefault(); }}>
            <a
              href="#main-content-v1"
              className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium"
            >
              Vai al contenuto principale
            </a>
            <button
              onClick={() => setFiltersOpen(true)}
              onMouseEnter={() => handleEdgeEnter("left")}
              onMouseLeave={() => handleEdgeLeave("left")}
              className={cn(
                "hidden sm:flex fixed left-0 top-[4.5rem] z-[60] items-center justify-center w-8 h-14 rounded-r-lg border border-l-0 border-primary/30 hover:border-primary/50 transition-all duration-300 ease-out cursor-pointer",
                filtersOpen && "opacity-0 pointer-events-none"
              )}
              style={{
                background: "hsl(var(--primary) / 0.25)",
                backdropFilter: "blur(8px)",
              }}
              aria-label="Apri filtri"
            >
              <SlidersHorizontal className="w-4 h-4 text-primary" />
            </button>
            <button
              onClick={() => setMissionOpen(true)}
              onMouseEnter={() => handleEdgeEnter("right")}
              onMouseLeave={() => handleEdgeLeave("right")}
              className={cn(
                "hidden sm:flex fixed right-0 top-[4.5rem] z-[60] items-center justify-center w-8 h-14 rounded-l-lg border border-r-0 border-primary/30 hover:border-primary/50 transition-all duration-300 ease-out cursor-pointer",
                missionOpen && "opacity-0 pointer-events-none"
              )}
              style={{
                background: "hsl(var(--primary) / 0.25)",
                backdropFilter: "blur(8px)",
              }}
              aria-label="Apri Mission"
            >
              <Target className="w-4 h-4 text-primary" />
            </button>
            <div className={`fixed left-0 top-0 z-50 h-full transition-transform duration-200 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`} onMouseLeave={() => setSidebarOpen(false)} role="navigation" aria-label="Menu principale">
              <AppSidebar collapsed={false} onToggle={() => setSidebarOpen(false)} />
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-30 h-11 sm:h-12 border-b border-border bg-background/80 backdrop-blur-md" role="banner">
                <TooltipProvider>
                  <div className="flex h-full items-center justify-between px-2 sm:px-4">
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                      <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" onClick={() = aria-label="Azione"> setSidebarOpen((o) => !o)} aria-label="Toggle sidebar"><Menu className="h-4 w-4" /></Button>

                      {currentPath.startsWith("/v1/network") && (
                        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs border-border/50" onClick={() => navigate("/v1/crm")}>
                          <Users className="w-3.5 h-3.5" /> CRM <ArrowRight className="w-3 h-3" />
                        </Button>
                      )}
                      {currentPath.startsWith("/v1/crm") && (
                        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs border-border/50" onClick={() => navigate("/v1/network")}>
                          <Globe className="w-3.5 h-3.5" /> Network <ArrowRight className="w-3 h-3" />
                        </Button>
                      )}

                      <ActiveProcessIndicator />
                      <ConnectionStatusBar onAiClick={() => setIntelliflowOpen(true)} outreachQueue={outreachQueue} nightPause={globalSync.nightPause} isNightTime={globalSync.isNightTime} manualOverride={globalSync.manualOverride} onToggleNightPause={globalSync.toggleNightPause} resumeMinutes={globalSync.resumeMinutes} />
                      <div id="campaign-header-controls" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3" />
                    </div>
                    <div className="flex items-center gap-0.5 sm:gap-1">
                      <OperatorSelector />
                      <InfoTooltip content="Nuovo Contatto"><Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-foreground/70 hover:text-primary transition-colors" onClick={() = aria-label="Aggiungi"> setAddContactOpen(true)} aria-label="Aggiungi contatto"><Plus className="h-4 w-4" /></Button></InfoTooltip>
                      <InfoTooltip content="Arricchimento"><Button variant="ghost" size="icon" className="hidden sm:inline-flex h-7 w-7 sm:h-8 sm:w-8 text-foreground/70 hover:text-primary transition-colors" onClick={() = aria-label="Azione"> navigate("/settings?tab=enrichment")} aria-label="Arricchimento"><DatabaseZap className="h-4 w-4" /></Button></InfoTooltip>
                      <InfoTooltip content="Operazioni Agenti"><Button variant="ghost" size="icon" className="hidden sm:inline-flex h-7 w-7 sm:h-8 sm:w-8 text-foreground/70 hover:text-primary transition-colors" onClick={() = aria-label="Azione"> setAgentDashOpen(true)} aria-label="Operazioni Agenti"><Activity className="h-4 w-4" /></Button></InfoTooltip>
                      <InfoTooltip content="Test Estensioni"><Button variant="ghost" size="icon" className="hidden md:inline-flex h-7 w-7 sm:h-8 sm:w-8 text-foreground/70 hover:text-primary transition-colors" onClick={() = aria-label="Azione"> setTestExtOpen(true)} aria-label="Test Estensioni"><FlaskConical className="h-4 w-4" /></Button></InfoTooltip>
                      <InfoTooltip content="Assistente Vocale LUCA"><Button variant="ghost" size="icon" className={cn("hidden sm:inline-flex h-7 w-7 sm:h-8 sm:w-8 transition-colors", voiceActive ? "text-destructive hover:text-destructive/80" : "text-foreground/70 hover:text-primary")} onClick={() = aria-label="Stop dettatura"> { setVoiceActive(v => !v); window.dispatchEvent(new CustomEvent("toggle-voice-fab")); }} aria-label="Assistente Vocale">{voiceActive ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button></InfoTooltip>
                      <InfoTooltip content="IntelliFlow AI (⌘J)"><Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-foreground/70 hover:text-primary transition-colors" onClick={() = aria-label="Aggiungi"> setIntelliflowOpen(true)} aria-label="IntelliFlow"><Sparkles className="h-4 w-4" /></Button></InfoTooltip>
                    </div>
                  </div>
                </TooltipProvider>
              </header>

              <main id="main-content-v1" tabIndex={-1} role="main" className={cn("flex-1 min-h-0 overflow-hidden mx-2 sm:mx-[36px]", isFullscreenRoute ? "" : "overflow-auto p-2 sm:p-4")}>
                <Outlet />
              </main>
            </div>

            {commandOpen && (
              <Suspense fallback={null}>
                <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
              </Suspense>
            )}
            {missionOpen && (
              <Suspense fallback={null}>
                <MissionDrawer open={missionOpen} onOpenChange={setMissionOpen} />
              </Suspense>
            )}
            {filtersOpen && (
              <Suspense fallback={null}>
                <FiltersDrawer open={filtersOpen} onOpenChange={setFiltersOpen} />
              </Suspense>
            )}
            {intelliflowOpen && (
              <Suspense fallback={null}>
                <IntelliFlowOverlay open={intelliflowOpen} onClose={() => setIntelliflowOpen(false)} />
              </Suspense>
            )}
            {addContactOpen && (
              <Suspense fallback={null}>
                <AddContactDialog open={addContactOpen} onOpenChange={setAddContactOpen} />
              </Suspense>
            )}
            <Dialog open={testExtOpen} onOpenChange={setTestExtOpen}>
              <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>🧪 Test Estensioni</DialogTitle>
                </DialogHeader>
                <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Caricamento...</div>}>
                  <TestExtensionsContent />
                </Suspense>
              </DialogContent>
            </Dialog>
            {agentDashOpen && (
              <Suspense fallback={null}>
                <AgentOperationsDashboard open={agentDashOpen} onOpenChange={setAgentDashOpen} />
              </Suspense>
            )}
          </div>
          <ClaudeBadge />
        </GlobalFiltersProvider>
      </MissionProvider>
    </DeepSearchContext.Provider>
  );
}

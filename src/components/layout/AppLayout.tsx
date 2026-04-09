import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";

import { ActiveProcessIndicator } from "./ActiveProcessIndicator";
import { CommandPalette } from "@/components/CommandPalette";
import { Menu, Sparkles, Target, SlidersHorizontal, Globe, Users, ArrowRight, Plus, FlaskConical, DatabaseZap } from "lucide-react";
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
import { MissionDrawer } from "@/components/global/MissionDrawer";
import { FiltersDrawer } from "@/components/global/FiltersDrawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const IntelliFlowOverlay = lazy(() => import("@/components/intelliflow/IntelliFlowOverlay"));
const TestExtensionsContent = lazy(() => import("@/pages/TestExtensions").then(m => ({ default: m.TestExtensionsContent })));
import { AddContactDialog } from "@/components/contacts/AddContactDialog";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [intelliflowOpen, setIntelliflowOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [testExtOpen, setTestExtOpen] = useState(false);
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
      // ⌘J now opens IntelliFlow (unified AI)
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setIntelliflowOpen((o) => !o); }
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

  // Global listener for AI UI actions
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      switch (detail.action_type) {
        case "navigate": if (detail.path) navigate(detail.path); break;
        case "show_toast": toast({ title: detail.toast_type === "error" ? "⚠️ Errore" : "✅ Fatto", description: detail.message || "" }); break;
        case "apply_filters": window.dispatchEvent(new CustomEvent("ai-command", { detail: { filters: detail.filters } })); break;
        case "start_download_job":
          if (detail.job_id) {
            toast({ title: "🤖 Job creato dall'agente", description: `Job ${detail.job_id.slice(0, 8)}… pronto. Vai su Network per avviarlo.` });
            navigate("/network");
          }
          break;
      }
    };
    window.addEventListener("ai-ui-action", handler);
    return () => window.removeEventListener("ai-ui-action", handler);
  }, [navigate]);

  // Edge hover zones
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
        {/* Visual tab triggers — follow drawer edges */}
        <button
          onClick={() => setFiltersOpen(true)}
          onMouseEnter={() => handleEdgeEnter("left")}
          onMouseLeave={() => handleEdgeLeave("left")}
          className={cn(
            "fixed left-0 top-[4.5rem] z-[60] flex items-center justify-center w-8 h-14 rounded-r-lg border border-l-0 border-purple-400/30 hover:border-purple-400/50 transition-all duration-300 ease-out cursor-pointer",
            filtersOpen && "opacity-0 pointer-events-none"
          )}
          style={{
            background: "hsla(270, 60%, 65%, 0.25)",
            backdropFilter: "blur(8px)",
          }}
          aria-label="Apri filtri"
        >
          <SlidersHorizontal className="w-4 h-4 text-purple-300" />
        </button>
        <button
          onClick={() => setMissionOpen(true)}
          onMouseEnter={() => handleEdgeEnter("right")}
          onMouseLeave={() => handleEdgeLeave("right")}
          className={cn(
            "fixed right-0 top-[4.5rem] z-[60] flex items-center justify-center w-8 h-14 rounded-l-lg border border-r-0 border-purple-400/30 hover:border-purple-400/50 transition-all duration-300 ease-out cursor-pointer",
            missionOpen && "opacity-0 pointer-events-none"
          )}
          style={{
            background: "hsla(270, 60%, 65%, 0.25)",
            backdropFilter: "blur(8px)",
          }}
          aria-label="Apri Mission"
        >
          <Target className="w-4 h-4 text-purple-300" />
        </button>
        <div className={`fixed left-0 top-0 z-50 h-full transition-transform duration-200 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`} onMouseLeave={() => setSidebarOpen(false)}>
          <AppSidebar collapsed={false} onToggle={() => setSidebarOpen(false)} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
           <header className="sticky top-0 z-30 h-11 sm:h-12 border-b border-border bg-background/80 backdrop-blur-md">
            <TooltipProvider>
             <div className="flex h-full items-center justify-between px-2 sm:px-4">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" onClick={() => setSidebarOpen((o) => !o)} aria-label="Toggle sidebar"><Menu className="h-4 w-4" /></Button>
                
                {/* Area switch */}
                {currentPath.startsWith("/network") && (
                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs border-border/50" onClick={() => navigate("/crm")}>
                    <Users className="w-3.5 h-3.5" /> CRM <ArrowRight className="w-3 h-3" />
                  </Button>
                )}
                {currentPath.startsWith("/crm") && (
                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs border-border/50" onClick={() => navigate("/network")}>
                    <Globe className="w-3.5 h-3.5" /> Network <ArrowRight className="w-3 h-3" />
                  </Button>
                )}

                <ActiveProcessIndicator />
                <ConnectionStatusBar onAiClick={() => setIntelliflowOpen(true)} outreachQueue={outreachQueue} nightPause={globalSync.nightPause} />
                <div id="campaign-header-controls" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3" />
              </div>
              <div className="flex items-center gap-0.5 sm:gap-1">
                <OperatorSelector />
                <InfoTooltip content="Nuovo Contatto"><Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground" onClick={() => setAddContactOpen(true)} aria-label="Aggiungi contatto"><Plus className="h-4 w-4" /></Button></InfoTooltip>
                <InfoTooltip content="Arricchimento"><Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground" onClick={() => navigate("/settings?tab=enrichment")} aria-label="Arricchimento"><DatabaseZap className="h-4 w-4" /></Button></InfoTooltip>
                <InfoTooltip content="Test Estensioni"><Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground" onClick={() => setTestExtOpen(true)} aria-label="Test Estensioni"><FlaskConical className="h-4 w-4" /></Button></InfoTooltip>
                <InfoTooltip content="IntelliFlow AI (⌘J)"><Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground" onClick={() => setIntelliflowOpen(true)} aria-label="IntelliFlow"><Sparkles className="h-4 w-4 text-purple-400" /></Button></InfoTooltip>
              </div>
            </div>
            </TooltipProvider>
          </header>

          <main className={cn("flex-1 min-h-0 overflow-hidden mx-[36px]", isFullscreenRoute ? "" : "overflow-auto p-4")}>
            <Outlet />
          </main>
        </div>

        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
        <MissionDrawer open={missionOpen} onOpenChange={setMissionOpen} />
        <FiltersDrawer open={filtersOpen} onOpenChange={setFiltersOpen} />


        <Suspense fallback={null}>
          <IntelliFlowOverlay open={intelliflowOpen} onClose={() => setIntelliflowOpen(false)} />
        </Suspense>
        <AddContactDialog open={addContactOpen} onOpenChange={setAddContactOpen} />
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
      </div>
    <ClaudeBadge />
        </GlobalFiltersProvider>
      </MissionProvider>
      </DeepSearchContext.Provider>
  );
}

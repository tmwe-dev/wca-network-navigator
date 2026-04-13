/**
 * AuthenticatedLayout template — Full sidebar with all nav items
 * Provides ALL providers, background hooks, and global overlays needed by V1 components
 */
import * as React from "react";
import { useEffect, useState, lazy, Suspense, useRef } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Globe, Users, Mail, Bot, Megaphone, Settings,
  Activity, LogOut, LayoutDashboard, ArrowDownLeft,
  Calendar, Target, Gauge, Crosshair, UserCog,
  FlaskConical, Book, BarChart3, Earth, Search,
  ArrowUpDown, Cpu, Cog, Upload, Send, Menu, X,
  Sparkles, SlidersHorizontal, Plus, DatabaseZap,
  Sun, Moon, Wifi, WifiOff, Command, ArrowRight,
} from "lucide-react";
import { Button } from "../atoms/Button";
import { Toaster as SonnerToaster, toast } from "sonner";
import { ClaudeBadge } from "@/components/system/ClaudeBadge";
import { Toaster } from "@/components/ui/toaster";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ── Providers (same order as V1 App.tsx + AppLayout.tsx) ──
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActiveOperatorProvider } from "@/contexts/ActiveOperatorContext";
import { ContactDrawerProvider } from "@/contexts/ContactDrawerContext";
import { DeepSearchContext, useDeepSearchRunner } from "@/hooks/useDeepSearchRunner";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import { MissionProvider } from "@/contexts/MissionContext";

// ── Background hooks (same as V1 AppLayout) ──
import { useJobHealthMonitor } from "@/hooks/useJobHealthMonitor";
import { useWcaSync } from "@/hooks/useWcaSync";
import { useOutreachQueue } from "@/hooks/useOutreachQueue";
import { useGlobalAutoSync } from "@/hooks/useGlobalAutoSync";
import { useWcaSession } from "@/hooks/useWcaSession";

// ── Header components ──
import { ConnectionStatusBar } from "@/components/layout/ConnectionStatusBar";
import { ActiveProcessIndicator } from "@/components/layout/ActiveProcessIndicator";
import { OperatorSelector } from "@/components/header/OperatorSelector";

// ── Global overlays (lazy loaded) ──
import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";

const ContactRecordDrawer = lazy(() => import("@/components/contact-drawer/ContactRecordDrawer").then(m => ({ default: m.ContactRecordDrawer })));
const MissionDrawer = lazy(() => import("@/components/global/MissionDrawer").then(m => ({ default: m.MissionDrawer })));
const FiltersDrawer = lazy(() => import("@/components/global/FiltersDrawer").then(m => ({ default: m.FiltersDrawer })));
const IntelliFlowOverlay = lazy(() => import("@/components/intelliflow/IntelliFlowOverlay"));
const CommandPalette = lazy(() => import("@/components/CommandPalette").then(m => ({ default: m.CommandPalette })));
const GlobalVoiceFAB = lazy(() => import("@/components/voice/GlobalVoiceFAB"));
const AddContactDialog = lazy(() => import("@/components/contacts/AddContactDialog").then(m => ({ default: m.AddContactDialog })));
const AgentOperationsDashboard = lazy(() => import("@/components/agents/AgentOperationsDashboard").then(m => ({ default: m.AgentOperationsDashboard })));
const TestExtensionsContent = lazy(() => import("@/pages/TestExtensions"));

// ── Sidebar nav items (grouped) ──

interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: React.ReactNode;
}

interface NavGroup {
  readonly title: string;
  readonly items: readonly NavItem[];
}

const navGroups: readonly NavGroup[] = [
  {
    title: "Principale",
    items: [
      { label: "Dashboard", path: "/v2", icon: <LayoutDashboard className="h-4 w-4" /> },
      { label: "Globo", path: "/v2/globe", icon: <Earth className="h-4 w-4" /> },
      { label: "Ricerca", path: "/v2/deep-search", icon: <Search className="h-4 w-4" /> },
    ],
  },
  {
    title: "Network & CRM",
    items: [
      { label: "Network", path: "/v2/network", icon: <Globe className="h-4 w-4" /> },
      { label: "CRM", path: "/v2/crm", icon: <Users className="h-4 w-4" /> },
      { label: "Prospect", path: "/v2/prospects", icon: <Target className="h-4 w-4" /> },
    ],
  },
  {
    title: "Comunicazione",
    items: [
      { label: "Outreach", path: "/v2/outreach", icon: <Mail className="h-4 w-4" /> },
      { label: "Inreach", path: "/v2/inreach", icon: <ArrowDownLeft className="h-4 w-4" /> },
      { label: "Componi", path: "/v2/email-composer", icon: <Send className="h-4 w-4" /> },
      { label: "Campagne", path: "/v2/campaigns", icon: <Megaphone className="h-4 w-4" /> },
      { label: "Agenda", path: "/v2/agenda", icon: <Calendar className="h-4 w-4" /> },
    ],
  },
  {
    title: "AI & Agenti",
    items: [
      { label: "Agenti", path: "/v2/agents", icon: <Bot className="h-4 w-4" /> },
      { label: "Cockpit", path: "/v2/cockpit", icon: <Gauge className="h-4 w-4" /> },
      { label: "Missioni", path: "/v2/missions", icon: <Crosshair className="h-4 w-4" /> },
      { label: "Staff", path: "/v2/staff", icon: <UserCog className="h-4 w-4" /> },
      { label: "AI Lab", path: "/v2/ai-lab", icon: <FlaskConical className="h-4 w-4" /> },
      { label: "Knowledge", path: "/v2/knowledge-base", icon: <Book className="h-4 w-4" /> },
    ],
  },
  {
    title: "Analisi",
    items: [
      { label: "Research", path: "/v2/research", icon: <BarChart3 className="h-4 w-4" /> },
      { label: "Ordinamento", path: "/v2/sorting", icon: <ArrowUpDown className="h-4 w-4" /> },
      { label: "Telemetria", path: "/v2/telemetry", icon: <Cpu className="h-4 w-4" /> },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Operazioni", path: "/v2/operations", icon: <Cog className="h-4 w-4" /> },
      { label: "Import", path: "/v2/import", icon: <Upload className="h-4 w-4" /> },
      { label: "Diagnostica", path: "/v2/diagnostics", icon: <Activity className="h-4 w-4" /> },
      { label: "Impostazioni", path: "/v2/settings", icon: <Settings className="h-4 w-4" /> },
    ],
  },
];

// ── Component ──

export function AuthenticatedLayout(): React.ReactElement | null {
  const { isAuthenticated, isLoading, profile, signOut } = useAuthV2();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Dynamic page title + close sidebar on nav
  useEffect(() => {
    const segment = location.pathname.replace("/v2", "").replace(/^\//, "") || "dashboard";
    const title = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
    document.title = `${title} — WCA Partners`;
    setSidebarOpen(false);
  }, [location.pathname]);

  // ── Session readiness gate (prevents RLS race condition) ──
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    let sub: { unsubscribe: () => void } | null = null;

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session) {
        setSessionReady(true);
      } else {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
          if (s && mounted) setSessionReady(true);
        });
        sub = subscription;
      }
    };
    check();
    return () => { mounted = false; sub?.unsubscribe(); };
  }, []);

  // Invalidate all queries once session is ready so RLS-gated data loads
  useEffect(() => {
    if (sessionReady) {
      queryClient.invalidateQueries();
    }
  }, [sessionReady]);

  // Overlay states (mirroring V1 AppLayout)
  const [commandOpen, setCommandOpen] = useState(false);
  const [intelliflowOpen, setIntelliflowOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [agentDashOpen, setAgentDashOpen] = useState(false);
  const [testExtOpen, setTestExtOpen] = useState(false);

  // Theme toggle
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("dl_theme", next ? "dark" : "light");
  };

  // DeepSearch runner
  const deepSearch = useDeepSearchRunner();

  // Background monitoring hooks (same as V1 AppLayout)
  useJobHealthMonitor();
  useWcaSync();
  const outreachQueue = useOutreachQueue();
  const globalSync = useGlobalAutoSync();

  // WCA Session status
  const wcaSession = useWcaSession();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/v2/login", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Keyboard shortcuts (Ctrl+K, Ctrl+J) + drawer events
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
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("open-drawer", drawerHandler);
    };
  }, []);

  // AI ↔ UI bridge: handles agent-dispatched commands
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

  // Edge hover triggers for drawers
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

  if (isLoading || !sessionReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const isActive = (path: string) => {
    if (path === "/v2") return location.pathname === "/v2";
    return location.pathname.startsWith(path);
  };

  const wcaStatusColor = wcaSession.sessionActive === true
    ? "text-emerald-400"
    : wcaSession.isChecking
      ? "text-primary animate-pulse"
      : "text-muted-foreground";

  const wcaStatusLabel = wcaSession.sessionActive === true
    ? "WCA Online"
    : wcaSession.isChecking
      ? "Verifica…"
      : wcaSession.sessionActive === false
        ? "WCA Offline"
        : "WCA";

  const sidebarContent = (
    <>
      {/* Brand header with glass effect */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Command className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground leading-tight">WCA Partners</h2>
            {profile?.displayName ? (
              <p className="text-[10px] text-muted-foreground truncate">{profile.displayName}</p>
            ) : null}
          </div>
        </div>
      </div>
      <nav className="flex-1 p-2 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-3">
            <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {group.title}
            </p>
            {group.items.map((navItem) => (
              <button
                key={navItem.path}
                onClick={() => { navigate(navItem.path); setMobileOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive(navItem.path)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
                )}
              >
                {navItem.icon}
                {navItem.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
      {/* Footer: WCA status, theme toggle, logout */}
      <div className="p-2 border-t border-border/50 space-y-1">
        {/* WCA Session Status */}
        <button
          onClick={() => wcaSession.ensureSession()}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
        >
          {wcaSession.sessionActive === true ? (
            <Wifi className={cn("h-3.5 w-3.5", wcaStatusColor)} />
          ) : (
            <WifiOff className={cn("h-3.5 w-3.5", wcaStatusColor)} />
          )}
          <span className={wcaStatusColor}>{wcaStatusLabel}</span>
        </button>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {isDark ? "Light Mode" : "Dark Mode"}
        </button>
        {/* Logout */}
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Esci
        </Button>
      </div>
    </>
  );

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ActiveOperatorProvider>
            <ContactDrawerProvider>
              <DeepSearchContext.Provider value={deepSearch}>
                <GlobalFiltersProvider>
                  <MissionProvider>
                    {/* Global system components */}
                    <SonnerToaster position="top-right" richColors closeButton />
                    <Toaster />

                    <div className="flex h-screen bg-background">
                      {/* Desktop sidebar — on-demand overlay */}
                      <div
                        className={`hidden md:block fixed left-0 top-0 z-50 h-full transition-transform duration-200 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
                        onMouseLeave={() => setSidebarOpen(false)}
                      >
                        <div className="w-56 h-full flex flex-col border-r border-border/40 bg-card/80 backdrop-blur-xl">
                          {sidebarContent}
                        </div>
                      </div>

                      {/* Mobile header */}
                      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b px-4 py-2 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-foreground">WCA Partners</h2>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setIntelliflowOpen(true)} className="p-1">
                            <Sparkles className="h-4 w-4 text-primary" />
                          </button>
                          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1">
                            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Mobile sidebar overlay */}
                      {mobileOpen ? (
                        <div className="md:hidden fixed inset-0 z-40 flex">
                          <div className="w-64 bg-card border-r flex flex-col mt-12">
                            {sidebarContent}
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

                      {/* Main content area */}
                      <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Desktop header — sticky operational bar */}
                        <header className="hidden md:flex h-11 items-center justify-between border-b border-border/40 bg-card/60 backdrop-blur-sm px-4 shrink-0">
                          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
                              <Menu className="h-4 w-4" />
                            </Button>
                            <ActiveProcessIndicator />
                            {location.pathname.startsWith("/v2/network") && (
                              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate("/v2/crm")}>
                                <ArrowRight className="h-3 w-3" /> CRM
                              </Button>
                            )}
                            {location.pathname.startsWith("/v2/crm") && (
                              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate("/v2/network")}>
                                <ArrowRight className="h-3 w-3" /> Network
                              </Button>
                            )}
                            <ConnectionStatusBar
                              onAiClick={() => setIntelliflowOpen(true)}
                              outreachQueue={outreachQueue}
                              nightPause={globalSync.nightPause}
                              isNightTime={globalSync.isNightTime}
                              manualOverride={globalSync.manualOverride}
                              onToggleNightPause={globalSync.toggleNightPause}
                              resumeMinutes={globalSync.resumeMinutes}
                            />
                            <div id="campaign-header-controls" className="flex min-w-0 flex-1 items-center gap-2" />
                          </div>
                          <div className="flex items-center gap-0.5">
                            <OperatorSelector />
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors" onClick={() => setAddContactOpen(true)} aria-label="Aggiungi contatto">
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors" onClick={() => navigate("/v2/settings?tab=enrichment")} aria-label="Arricchimento">
                              <DatabaseZap className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors" onClick={() => setAgentDashOpen(true)} aria-label="Agent Operations">
                              <Activity className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors" onClick={() => setTestExtOpen(true)} aria-label="Test Estensioni">
                              <FlaskConical className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors" onClick={() => setIntelliflowOpen(true)} aria-label="IntelliFlow AI">
                              <Sparkles className="h-4 w-4" />
                            </Button>
                          </div>
                        </header>

                        {/* Page content */}
                        <main className="flex-1 overflow-y-auto md:mt-0 mt-12">
                          <Outlet />
                        </main>
                      </div>
                    </div>

                    {/* Global overlays (lazy loaded, same as V1 AppLayout) */}
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
                    {agentDashOpen && (
                      <Suspense fallback={null}>
                        <AgentOperationsDashboard open={agentDashOpen} onOpenChange={setAgentDashOpen} />
                      </Suspense>
                    )}
                    {testExtOpen && (
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
                    )}

                    {/* Global drawers */}
                    <Suspense fallback={null}>
                      <ContactRecordDrawer />
                    </Suspense>
                    <ClaudeBadge />
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

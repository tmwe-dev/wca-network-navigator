/**
 * AuthenticatedLayout template — Full sidebar with all nav items
 * Provides ALL providers and global overlays needed by V1 components
 */
import * as React from "react";
import { useEffect, useState, lazy, Suspense, useRef } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { cn } from "@/lib/utils";
import {
  Globe, Users, Mail, Bot, Megaphone, Settings,
  Activity, LogOut, LayoutDashboard, ArrowDownLeft,
  Calendar, Target, Gauge, Crosshair, UserCog,
  FlaskConical, Book, BarChart3, Earth, Search,
  ArrowUpDown, Cpu, Cog, Upload, Send, Menu, X,
  Sparkles, SlidersHorizontal, Plus,
} from "lucide-react";
import { Button } from "../atoms/Button";

// ── Providers (same order as V1 App.tsx + AppLayout.tsx) ──
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActiveOperatorProvider } from "@/contexts/ActiveOperatorContext";
import { ContactDrawerProvider } from "@/contexts/ContactDrawerContext";
import { DeepSearchContext, useDeepSearchRunner } from "@/hooks/useDeepSearchRunner";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import { MissionProvider } from "@/contexts/MissionContext";

// ── Global overlays (lazy loaded) ──
import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";
import { ConnectionBanner } from "@/components/system/ConnectionBanner";
import { ViteChunkRecovery } from "@/components/system/ViteChunkRecovery";
import { BackgroundSyncIndicator } from "@/components/BackgroundSyncIndicator";

const ContactRecordDrawer = lazy(() => import("@/components/contact-drawer/ContactRecordDrawer").then(m => ({ default: m.ContactRecordDrawer })));
const RuntimeDiagnosticPanel = lazy(() => import("@/components/system/RuntimeDiagnosticPanel").then(m => ({ default: m.RuntimeDiagnosticPanel })));
const MissionDrawer = lazy(() => import("@/components/global/MissionDrawer").then(m => ({ default: m.MissionDrawer })));
const FiltersDrawer = lazy(() => import("@/components/global/FiltersDrawer").then(m => ({ default: m.FiltersDrawer })));
const IntelliFlowOverlay = lazy(() => import("@/components/intelliflow/IntelliFlowOverlay"));
const CommandPalette = lazy(() => import("@/components/CommandPalette").then(m => ({ default: m.CommandPalette })));
const AddContactDialog = lazy(() => import("@/components/contacts/AddContactDialog").then(m => ({ default: m.AddContactDialog })));
const AgentOperationsDashboard = lazy(() => import("@/components/agents/AgentOperationsDashboard").then(m => ({ default: m.AgentOperationsDashboard })));

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

  // Overlay states (mirroring V1 AppLayout)
  const [commandOpen, setCommandOpen] = useState(false);
  const [intelliflowOpen, setIntelliflowOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [agentDashOpen, setAgentDashOpen] = useState(false);

  // DeepSearch runner
  const deepSearch = useDeepSearchRunner();

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

  if (isLoading) {
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

  const sidebarContent = (
    <>
      <div className="p-4 border-b">
        <h2 className="text-lg font-bold text-foreground">WCA v2</h2>
        {profile?.displayName ? (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{profile.displayName}</p>
        ) : null}
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
      <div className="p-2 border-t">
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
                    <ViteChunkRecovery />
                    <BackgroundSyncIndicator />
                    <ConnectionBanner />
                    <Suspense fallback={null}>
                      <RuntimeDiagnosticPanel />
                    </Suspense>

                    <div className="flex h-screen bg-background">
                      {/* Desktop sidebar */}
                      <aside className="hidden md:flex w-56 flex-col border-r bg-card">
                        {sidebarContent}
                      </aside>

                      {/* Mobile header */}
                      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b px-4 py-2 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-foreground">WCA v2</h2>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setIntelliflowOpen(true)} className="p-1">
                            <Sparkles className="h-4 w-4 text-purple-400" />
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
                          "hidden md:flex fixed left-56 top-16 z-[60] items-center justify-center w-6 h-12 rounded-r-lg border border-l-0 border-purple-400/30 hover:border-purple-400/50 transition-all cursor-pointer",
                          filtersOpen && "opacity-0 pointer-events-none"
                        )}
                        style={{ background: "hsla(270, 60%, 65%, 0.25)", backdropFilter: "blur(8px)" }}
                        aria-label="Apri filtri"
                      >
                        <SlidersHorizontal className="w-3 h-3 text-purple-300" />
                      </button>
                      <button
                        onClick={() => setMissionOpen(true)}
                        onMouseEnter={() => handleEdgeEnter("right")}
                        onMouseLeave={() => handleEdgeLeave("right")}
                        className={cn(
                          "hidden md:flex fixed right-0 top-16 z-[60] items-center justify-center w-6 h-12 rounded-l-lg border border-r-0 border-purple-400/30 hover:border-purple-400/50 transition-all cursor-pointer",
                          missionOpen && "opacity-0 pointer-events-none"
                        )}
                        style={{ background: "hsla(270, 60%, 65%, 0.25)", backdropFilter: "blur(8px)" }}
                        aria-label="Apri Mission"
                      >
                        <Target className="w-3 h-3 text-purple-300" />
                      </button>

                      {/* Main content */}
                      <main className="flex-1 overflow-y-auto md:mt-0 mt-12">
                        <Outlet />
                      </main>
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

                    {/* Global drawers */}
                    <Suspense fallback={null}>
                      <ContactRecordDrawer />
                    </Suspense>
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

/**
 * AuthenticatedLayout template — Full sidebar with all nav items
 */
import * as React from "react";
import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { cn } from "@/lib/utils";
import {
  Globe, Users, Mail, Bot, Megaphone, Settings,
  Activity, LogOut, LayoutDashboard, ArrowDownLeft,
  Calendar, Target, Gauge, Crosshair, UserCog,
  FlaskConical, Book, BarChart3, Earth, Search,
  ArrowUpDown, Cpu, Cog, Upload, Send, Menu, X,
} from "lucide-react";
import { Button } from "../atoms/Button";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import { MissionProvider } from "@/contexts/MissionContext";

const MissionDrawer = lazy(() => import("@/components/global/MissionDrawer").then((m) => ({ default: m.MissionDrawer })));
const FiltersDrawer = lazy(() => import("@/components/global/FiltersDrawer").then((m) => ({ default: m.FiltersDrawer })));

// ── Sidebar nav items (grouped) ──────────────────────────────────────

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

// ── Component ────────────────────────────────────────────────────────

export function AuthenticatedLayout(): React.ReactElement | null {
  const { isAuthenticated, isLoading, profile, signOut } = useAuthV2();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/v2/login", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

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
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r bg-card">
        {sidebarContent}
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b px-4 py-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">WCA v2</h2>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
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

      {/* Main content */}
      <main className="flex-1 overflow-y-auto md:mt-0 mt-12">
        <Outlet />
      </main>
    </div>
  );
}

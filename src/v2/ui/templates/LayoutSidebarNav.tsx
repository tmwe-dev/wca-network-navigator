/**
 * LayoutSidebarNav — Navigation groups for the sidebar
 */
import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Globe, Users, Mail, Bot, Megaphone, Settings,
  Activity, LogOut, LayoutDashboard, ArrowDownLeft,
  Calendar, Target, Gauge, Crosshair, UserCog,
  FlaskConical, Book, BarChart3, Earth, Search,
  ArrowUpDown, Cpu, Cog, Upload, Send, Command,
  Wifi, WifiOff, Sun, Moon, BrainCircuit, ShieldCheck, Gamepad2,
} from "lucide-react";
import { Button } from "../atoms/Button";

interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: React.ReactNode;
}

interface NavGroup {
  readonly title: string;
  readonly items: readonly NavItem[];
}

export const navGroups: readonly NavGroup[] = [
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
      { label: "AI Arena", path: "/v2/ai-arena", icon: <Gamepad2 className="h-4 w-4" /> },
      { label: "Email Intelligence", path: "/v2/email-intelligence", icon: <BrainCircuit className="h-4 w-4" /> },
      { label: "AI Control", path: "/v2/ai-control", icon: <ShieldCheck className="h-4 w-4" /> },
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

interface SidebarProps {
  profileName?: string | null;
  wcaStatusColor: string;
  wcaStatusLabel: string;
  wcaSessionActive: boolean | null;
  onWcaReconnect: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onSignOut: () => void;
  onMobileClose?: () => void;
}

export function LayoutSidebarNav({
  profileName, wcaStatusColor, wcaStatusLabel, wcaSessionActive,
  onWcaReconnect, isDark, onToggleTheme, onSignOut, onMobileClose,
}: SidebarProps): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/v2") return location.pathname === "/v2";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Command className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground leading-tight">WCA Partners</h2>
            {profileName ? (
              <p className="text-[10px] text-muted-foreground truncate">{profileName}</p>
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
                onClick={() => { navigate(navItem.path); onMobileClose?.(); }}
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
      <div className="p-2 border-t border-border/50 space-y-1">
        <button
          onClick={onWcaReconnect}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
        >
          {wcaSessionActive === true ? (
            <Wifi className={cn("h-3.5 w-3.5", wcaStatusColor)} />
          ) : (
            <WifiOff className={cn("h-3.5 w-3.5", wcaStatusColor)} />
          )}
          <span className={wcaStatusColor}>{wcaStatusLabel}</span>
        </button>
        <button
          onClick={onToggleTheme}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {isDark ? "Light Mode" : "Dark Mode"}
        </button>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
          Esci
        </Button>
      </div>
    </>
  );
}

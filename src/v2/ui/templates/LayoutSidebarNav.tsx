/**
 * LayoutSidebarNav — Navigation groups for the sidebar
 */
import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { prefetchRoute } from "@/lib/prefetchRoutes";
import {
  Globe, Users, Mail, Bot, Megaphone, Settings,
  Activity, LogOut, LayoutDashboard, ArrowDownLeft,
  Calendar, Target, Gauge, Crosshair, UserCog,
  FlaskConical, Book, BarChart3, Earth, Search,
  ArrowUpDown, Cpu, Cog, Upload, Send, Command,
  Wifi, WifiOff, Sun, Moon, BrainCircuit, ShieldCheck, Gamepad2,
  MessageSquare, Brain, Rocket, BookOpen, Wand2,
} from "lucide-react";
import { Button } from "../atoms/Button";

interface NavItem {
  readonly labelKey: string;
  readonly path: string;
  readonly icon: React.ReactNode;
}

interface NavGroup {
  readonly titleKey: string;
  readonly items: readonly NavItem[];
}

const navGroupsDef: readonly NavGroup[] = [
  {
    titleKey: "nav.group_ai_command",
    items: [
      { labelKey: "nav.command", path: "/v2/command", icon: <MessageSquare className="h-4 w-4" /> },
    ],
  },
  {
    titleKey: "nav.group_overview",
    items: [
      { labelKey: "nav.dashboard", path: "/v2", icon: <LayoutDashboard className="h-4 w-4" /> },
      { labelKey: "nav.network", path: "/v2/network", icon: <Globe className="h-4 w-4" /> },
      { labelKey: "nav.globe", path: "/v2/globe", icon: <Earth className="h-4 w-4" /> },
      { labelKey: "nav.crm", path: "/v2/crm", icon: <Users className="h-4 w-4" /> },
    ],
  },
  {
    titleKey: "nav.group_communication",
    items: [
      { labelKey: "nav.outreach", path: "/v2/outreach", icon: <Mail className="h-4 w-4" /> },
      { labelKey: "nav.inreach", path: "/v2/inreach", icon: <ArrowDownLeft className="h-4 w-4" /> },
      { labelKey: "nav.agenda", path: "/v2/outreach/agenda", icon: <Calendar className="h-4 w-4" /> },
      { labelKey: "nav.campaigns", path: "/v2/campaigns", icon: <Megaphone className="h-4 w-4" /> },
      { labelKey: "nav.approvals", path: "/v2/sorting", icon: <ArrowUpDown className="h-4 w-4" /> },
      { labelKey: "nav.ai_arena", path: "/v2/ai-arena", icon: <Gamepad2 className="h-4 w-4" /> },
    ],
  },
  {
    titleKey: "nav.group_intelligence",
    items: [
      { labelKey: "nav.email_intelligence", path: "/v2/email-intelligence", icon: <BrainCircuit className="h-4 w-4" /> },
      { labelKey: "Email Forge", path: "/v2/ai-staff/email-forge", icon: <Wand2 className="h-4 w-4" /> },
      { labelKey: "nav.research", path: "/v2/research", icon: <BarChart3 className="h-4 w-4" /> },
    ],
  },
  {
    titleKey: "nav.group_ai_operations",
    items: [
      { labelKey: "nav.agents", path: "/v2/agents", icon: <Bot className="h-4 w-4" /> },
      { labelKey: "nav.missions", path: "/v2/agents/missions", icon: <Rocket className="h-4 w-4" /> },
      { labelKey: "nav.ai_staff", path: "/v2/ai-staff", icon: <UserCog className="h-4 w-4" /> },
      { labelKey: "nav.ai_control", path: "/v2/ai-control", icon: <ShieldCheck className="h-4 w-4" /> },
    ],
  },
  {
    titleKey: "nav.group_system",
    items: [
      { labelKey: "nav.settings", path: "/v2/settings", icon: <Settings className="h-4 w-4" /> },
      { labelKey: "nav.guide", path: "/v2/guida", icon: <BookOpen className="h-4 w-4" /> },
    ],
  },
];

/** Backward-compatible export for any code referencing navGroups */
export const navGroups = navGroupsDef.map((g) => ({
  title: g.titleKey,
  items: g.items.map((i) => ({ label: i.labelKey, path: i.path, icon: i.icon })),
}));

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
  const { t } = useTranslation();

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
      <nav className="flex-1 p-2 overflow-y-auto" data-testid="main-sidebar">
        {navGroupsDef.map((group, groupIdx) => (
          <div key={group.titleKey}>
            <div className="mb-3">
              <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t(group.titleKey)}
              </p>
              {group.items.map((navItem) => {
                const navId = navItem.path.replace("/v2/", "").replace("/v2", "dashboard").replace(/\//g, "-") || "dashboard";
                return (
                <button
                  key={navItem.path}
                  data-testid={`nav-${navId}`}
                  onMouseEnter={() => prefetchRoute(navItem.path)}
                  onClick={() => { navigate(navItem.path); onMobileClose?.(); }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive(navItem.path)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
                  )}
                >
                  {navItem.icon}
                  {t(navItem.labelKey)}
                  {navItem.path === "/v2/command" && (
                    <span className="ml-auto text-[9px] font-bold uppercase bg-primary/15 text-primary px-1.5 py-0.5 rounded">NEW</span>
                  )}
                </button>
                );
              })}
            </div>
            {groupIdx === 0 && <div className="mx-3 mb-3 border-b border-border/50" />}
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
          {isDark ? t("common.light_mode") : t("common.dark_mode")}
        </button>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
          {t("common.logout")}
        </Button>
      </div>
    </>
  );
}

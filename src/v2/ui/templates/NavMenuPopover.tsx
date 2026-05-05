/**
 * NavMenuPopover — Dropdown di navigazione globale, identico in tutte le
 * pagine. Usato sia in CommandPage (trigger custom "Menu" fixed top-left)
 * sia in LayoutHeader (trigger ☰ standard).
 *
 * Single source of truth: navItemsDef.
 */
import * as React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Layers, LogOut } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { navItemsDef } from "./navConfig";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { ThemePicker } from "@/v2/ui/theme/ThemePicker";

const DEV_PAGE_GROUPS: ReadonlyArray<{ title: string; items: ReadonlyArray<{ label: string; path: string }> }> = [
  {
    title: "Acquisizione & Ricerca",
    items: [
      { label: "Prospects", path: "/v2/crm/prospects" },
      { label: "Acquisizione Partner", path: "/v2/crm/acquisition" },
      { label: "Research", path: "/v2/research" },
      { label: "RA Explorer", path: "/v2/ra-explorer" },
      { label: "RA Scraping Engine", path: "/v2/ra-scraping" },
      { label: "Sorting", path: "/v2/sorting" },
    ],
  },
  {
    title: "Agenti & Missioni",
    items: [
      { label: "Editor Persona", path: "/v2/agents/persona" },
      { label: "Mission Builder", path: "/v2/agents/missions" },
      { label: "Missioni Autopilot", path: "/v2/agents/autopilot" },
      { label: "Agent Capabilities", path: "/v2/agents/capabilities" },
      { label: "Agent Tasks", path: "/v2/agents/tasks" },
    ],
  },
  {
    title: "Prompt Lab",
    items: [
      { label: "Agent Atlas", path: "/v2/prompt-lab/atlas" },
      { label: "Suggestions Review", path: "/v2/prompt-lab/suggestions" },
      { label: "Prompt Catalog", path: "/v2/prompt-lab/catalog" },
      { label: "Registro Interazioni AI", path: "/v2/ai-interactions-log" },
    ],
  },
  {
    title: "AI Staff",
    items: [
      { label: "AI Staff Hub", path: "/v2/ai-staff" },
      { label: "KB Supervisor", path: "/v2/ai-staff/kb-supervisor" },
      { label: "AI Lab Test", path: "/v2/ai-staff/lab" },
      { label: "Email Forge", path: "/v2/ai-staff/email-forge" },
      { label: "AI Arena 3D", path: "/v2/ai-arena" },
    ],
  },
  {
    title: "Calendario & Campagne",
    items: [
      { label: "Calendar", path: "/v2/calendar" },
      { label: "Outreach Agenda", path: "/v2/outreach/agenda" },
      { label: "Campaign Jobs", path: "/v2/campaigns/jobs" },
    ],
  },
  {
    title: "Cockpit & Analytics",
    items: [
      { label: "Analytics", path: "/v2/analytics" },
      { label: "KPI Dashboard", path: "/v2/kpi" },
      { label: "Token Cockpit", path: "/v2/token-cockpit" },
      { label: "Notifications", path: "/v2/notifications" },
      { label: "AI Control Center", path: "/v2/ai-control" },
    ],
  },
  {
    title: "Sistema & Admin",
    items: [
      { label: "Admin Users", path: "/v2/settings/admin-users" },
      { label: "Email Download", path: "/v2/settings/email-download" },
      { label: "Diagnostics", path: "/v2/settings/diagnostics" },
      { label: "Telemetry", path: "/v2/settings/telemetry" },
      { label: "Observability", path: "/v2/settings/observability" },
      { label: "System Health", path: "/v2/settings/health" },
      { label: "Design System", path: "/v2/design-system-preview" },
      { label: "Guida", path: "/v2/guida" },
    ],
  },
];

/** Estrae la radice di sezione: `/v2/intelligence/agents` → `/v2/intelligence`. */
function sectionRoot(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) return "/v2";
  return `/${parts[0]}/${parts[1]}`;
}

interface NavMenuPopoverProps {
  /** Trigger element (e.g. icon button). Renders inside <PopoverTrigger asChild>. */
  children: React.ReactNode;
  /** Path corrente, usato per nascondere la voce attiva. */
  currentPath?: string;
  /** Allineamento del contenuto rispetto al trigger. Default: start. */
  align?: "start" | "center" | "end";
}

export function NavMenuPopover({
  children,
  currentPath,
  align = "start",
}: NavMenuPopoverProps): React.ReactElement {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const { signOut } = useAuthV2();

  const handleSelect = (path: string) => {
    setOpen(false);
    nav(path);
  };

  const activeRoot = currentPath ? sectionRoot(currentPath) : null;
  const isInDev = !!currentPath && DEV_PAGE_GROUPS.some((g) => g.items.some((i) => i.path === currentPath));
  React.useEffect(() => {
    if (isInDev) setDevOpen(true);
  }, [isInDev]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={8}
        className="w-72 p-1 bg-background/95 backdrop-blur-xl border-white/10 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex flex-col">
          {navItemsDef.map((item) => {
              const isActive = sectionRoot(item.path) === activeRoot;
              const translated = t(item.labelKey);
              const label =
                translated === item.labelKey
                  ? item.labelKey.replace(/^nav\./, "").replace(/_/g, " ")
                  : translated;
              return (
                <button
                  key={item.path}
                  role="menuitem"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => handleSelect(item.path)}
                  className={
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left capitalize " +
                    (isActive
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-foreground/90 hover:bg-white/5 hover:text-foreground")
                  }
                >
                  <span className="text-muted-foreground">{item.icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          <div className="my-1 border-t border-white/10" />
          <button
            type="button"
            onClick={() => setDevOpen((v) => !v)}
            aria-expanded={devOpen}
            className={
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left " +
              (isInDev
                ? "bg-primary/15 text-primary font-semibold"
                : "text-foreground/90 hover:bg-white/5 hover:text-foreground")
            }
          >
            <span className="text-muted-foreground"><Layers className="h-4 w-4" /></span>
            <span className="flex-1">Development</span>
            {devOpen ? <ChevronDown className="h-4 w-4 opacity-60" /> : <ChevronRight className="h-4 w-4 opacity-60" />}
          </button>
          {devOpen && (
            <div className="mt-1 space-y-2 pb-1 pl-2">
              {DEV_PAGE_GROUPS.map((group) => (
                <div key={group.title}>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.title}
                  </div>
                  <div className="flex flex-col">
                    {group.items.map((item) => {
                      const isActive = currentPath === item.path;
                      return (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => handleSelect(item.path)}
                          aria-current={isActive ? "page" : undefined}
                          className={
                            "flex items-center px-3 py-1.5 rounded-md text-xs transition-colors text-left " +
                            (isActive
                              ? "bg-primary/15 text-primary font-semibold"
                              : "text-foreground/80 hover:bg-white/5 hover:text-foreground")
                          }
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="my-1 border-t border-white/10" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left text-destructive hover:bg-destructive/10"
          >
            <span><LogOut className="h-4 w-4" /></span>
            <span>Logout</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
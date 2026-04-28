/**
 * OrphanPagesNav — Mostra le pagine "orfane" (raggiungibili solo via deep-link,
 * NON presenti nei 6 destinations principali) in una lista collassabile
 * sotto la nav principale. Migliora la scopribilità senza rompere il design
 * 6-destination della Phase 1.
 */
import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrphanLink {
  readonly label: string;
  readonly path: string;
}

interface OrphanGroup {
  readonly title: string;
  readonly items: readonly OrphanLink[];
}

const ORPHAN_GROUPS: readonly OrphanGroup[] = [
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
    title: "Prompt Lab Avanzato",
    items: [
      { label: "Agent Atlas", path: "/v2/prompt-lab/atlas" },
      { label: "Suggestions Review", path: "/v2/prompt-lab/suggestions" },
      { label: "Prompt Catalog", path: "/v2/prompt-lab/catalog" },
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
    ],
  },
  {
    title: "Sistema & Admin",
    items: [
      { label: "Settings", path: "/v2/settings" },
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

interface Props {
  readonly onNavigate?: () => void;
}

export function OrphanPagesNav({ onNavigate }: Props): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = React.useState(false);

  const handleClick = (path: string): void => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <div className="mt-3 border-t border-border/50 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
        aria-expanded={open}
        data-testid="orphan-pages-toggle"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className="flex-1 text-left">Tutte le pagine</span>
      </button>
      {open && (
        <div className="mt-1 space-y-3 px-1 pb-2">
          {ORPHAN_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => handleClick(item.path)}
                      className={cn(
                        "flex w-full items-center rounded-md px-3 py-1.5 text-xs transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                      )}
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
    </div>
  );
}

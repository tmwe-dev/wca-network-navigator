/**
 * AutoPageTitle — Mostra automaticamente il titolo della pagina corrente
 * (icona + label derivati da pathname/breadcrumbs) nello slot `page-title-slot`.
 * Si auto-disattiva se la pagina ha già montato il proprio PageTitleHeader
 * (osserva i figli dello slot via MutationObserver).
 */
import * as React from "react";
import { useLocation } from "react-router-dom";
import { buildCrumbs } from "../breadcrumbConfig";
import {
  FileText, LayoutDashboard, Search, Kanban, Radar, Brain, Settings,
  Calendar, Inbox, Mail, Users, BookOpen, FlaskConical, Activity,
  Database, Globe, MessageSquare, Sparkles, Bot, ListChecks, Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Mappa icona per il primo segmento del path V2 (e alias legacy).
 * Permette al fallback automatico di mostrare un'icona contestuale
 * senza che ogni pagina debba dichiarare PageTitleHeader.
 */
const SEGMENT_ICON: Record<string, LucideIcon> = {
  // 6 sezioni canoniche
  explore: Search,
  pipeline: Kanban,
  communicate: Radar,
  intelligence: Brain,
  settings: Settings,
  // legacy / sub
  dashboard: LayoutDashboard,
  cockpit: LayoutDashboard,
  contacts: Users,
  crm: Kanban,
  agenda: Calendar,
  calendar: Calendar,
  inbox: Inbox,
  "funnemail-inbox": Inbox,
  outreach: Mail,
  inreach: Mail,
  composer: Mail,
  "email-forge": Mail,
  agents: Bot,
  "agent-tasks": ListChecks,
  "prompt-lab": FlaskConical,
  "kb-supervisor": BookOpen,
  kb: BookOpen,
  "ai-control-center": Shield,
  "ai-arena": Sparkles,
  "ai-lab": FlaskConical,
  diagnostics: Activity,
  analytics: Activity,
  command: MessageSquare,
  network: Globe,
  globe: Globe,
  campaigns: Sparkles,
  "deep-search": Search,
  import: Database,
  "admin-users": Shield,
};

function pickIcon(pathname: string): LucideIcon {
  // /v2/<segment>/...
  const parts = pathname.replace(/^\/v2\/?/, "").split("/").filter(Boolean);
  for (const p of parts) {
    const icon = SEGMENT_ICON[p];
    if (icon) return icon;
  }
  return FileText;
}

export function AutoPageTitle(): React.ReactElement | null {
  const { pathname } = useLocation();
  const [slotHasChild, setSlotHasChild] = React.useState(false);

  React.useEffect(() => {
    const slot = document.getElementById("page-title-slot");
    if (!slot) return;
    const update = (): void => {
      // Conta solo figli che NON sono il nostro fallback
      const children = Array.from(slot.children).filter(
        (c) => !c.hasAttribute("data-auto-page-title"),
      );
      setSlotHasChild(children.length > 0);
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(slot, { childList: true, subtree: false });
    return () => obs.disconnect();
  }, [pathname]);

  if (slotHasChild) return null;
  if (pathname === "/v2" || pathname === "/v2/") return null;

  const crumbs = buildCrumbs(pathname);
  const last = crumbs[crumbs.length - 1];
  if (!last) return null;

  const Icon = pickIcon(pathname);

  return (
    <div
      data-auto-page-title
      className="inline-flex items-center gap-1.5 rounded-md bg-primary-foreground/95 px-2 py-1 border border-primary/30 shadow-sm min-w-0"
    >
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm font-semibold text-primary truncate">
        {last.label}
      </span>
    </div>
  );
}
/**
 * breadcrumbConfig — derives breadcrumb segments from the current pathname.
 * The 6 canonical sections own their own labels; sub-paths are humanized.
 * Used by GoldenHeaderBar.
 */

export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

const SECTION_LABELS: Record<string, string> = {
  "": "Home",
  explore: "Esplora",
  pipeline: "Pipeline",
  communicate: "Comunica",
  intelligence: "Intelligence",
  settings: "Config",
  // legacy roots that still resolve directly
  crm: "Pipeline",
  contacts: "Contatti",
  outreach: "Comunica",
  inreach: "Comunica",
  agents: "Intelligence",
  campaigns: "Esplora",
  network: "Esplora",
  globe: "Esplora",
};

const SUB_LABELS: Record<string, string> = {
  contacts: "Contatti",
  kanban: "Kanban",
  prospects: "Prospect",
  acquisition: "Acquisizione",
  deals: "Deals",
  agenda: "Agenda",
  inbox: "Inbox",
  outreach: "Outreach",
  composer: "Componi",
  "email-forge": "Email Forge",
  approvals: "Approvazioni",
  sorting: "Approvazioni",
  agents: "Agenti",
  "prompt-lab": "Prompt Lab",
  kb: "Knowledge Base",
  "kb-supervisor": "Knowledge Base",
  control: "AI Control",
  analytics: "Analytics",
  map: "Mappa",
  search: "Cerca",
  "deep-search": "Deep Search",
  campaigns: "Campagne",
  network: "Network",
  globe: "Mappa",
  guida: "Guida",
  calendar: "Calendario",
  "token-cockpit": "Token",
  notifications: "Notifiche",
  "admin-users": "Admin",
};

function humanize(seg: string): string {
  return seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns ordered crumbs for a `/v2/...` pathname.
 * The "Home" root is always first; the current page is last (no href).
 */
export function buildCrumbs(pathname: string): readonly Crumb[] {
  const cleaned = pathname.replace(/^\/v2\/?/, "").replace(/\/+$/, "");
  if (!cleaned) return [{ label: "Home" }];

  const parts = cleaned.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ label: "Home", href: "/v2" }];

  let acc = "/v2";
  parts.forEach((part, idx) => {
    acc += `/${part}`;
    const isLast = idx === parts.length - 1;
    const label =
      idx === 0
        ? SECTION_LABELS[part] ?? humanize(part)
        : SUB_LABELS[part] ?? humanize(part);
    crumbs.push({ label, href: isLast ? undefined : acc });
  });

  return crumbs;
}

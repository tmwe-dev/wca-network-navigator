/**
 * Navigation Registry — Single Source of Truth for V2 navigation.
 *
 * Sostituisce le 3 liste duplicate di pagine secondarie/dev che erano
 * hard-coded in:
 *   - src/v2/ui/templates/OrphanPagesNav.tsx (ORPHAN_GROUPS)
 *   - src/v2/ui/templates/NavMenuPopover.tsx (DEV_PAGE_GROUPS)
 *   - src/v2/ui/pages/SettingsPage.tsx       (DEV_PAGE_GROUPS)
 *
 * Aggiungere/rimuovere/spostare una pagina dev qui è UN SOLO edit.
 *
 * Le 14 voci canoniche del menu principale restano in
 * `src/v2/ui/templates/navConfig.tsx::navItemsDef` per non rompere la UX
 * di Fase 1 (icone + i18n + pinOrder già consolidati).
 */

export interface SecondaryNavItem {
  readonly label: string;
  readonly path: string;
  /** Marca temporaneamente le rotte deprecate. La UI può mostrare un badge. */
  readonly deprecated?: boolean;
  /** Marca le rotte solo-deep-link (escluse dai menu pubblici). */
  readonly hidden?: boolean;
}

export interface SecondaryNavSubGroup {
  readonly title: string;
  readonly items: readonly SecondaryNavItem[];
}

export interface SecondaryNavGroup {
  readonly title: string;
  /** Voci dirette del gruppo (mutuamente esclusivo con `subGroups`, oppure mostrate sopra di essi). */
  readonly items?: readonly SecondaryNavItem[];
  /** Sotto-cartelle annidate (accordion-in-accordion). */
  readonly subGroups?: readonly SecondaryNavSubGroup[];
}

/**
 * SECONDARY_NAV — pagine dev/orfane, non nel menu principale ma scopribili
 * via popover, sezione "Tutte le pagine" e tab Development di Settings.
 *
 * 2026-05-13: introdotti subGroups (sotto-cartelle).
 *  - "AI Staff" rimosso: AI Staff Hub e AI Arena 3D spostati dentro
 *    "Agenti & Missioni"; KB Supervisor spostato in "Lab & Verifiche (hub)".
 *  - "Email Forge" spostato in "Lab & Verifiche (hub)".
 *  - "Calendario & Campagne" rinominato in "Agenda & Pipeline".
 */
export const SECONDARY_NAV: readonly SecondaryNavGroup[] = [
  {
    title: "Acquisizione & Ricerca",
    items: [
      { label: "Acquisizione Partner", path: "/v2/crm/acquisition" },
      { label: "Prospects",            path: "/v2/crm/prospects" },
      { label: "RA Explorer",          path: "/v2/ra-explorer" },
      { label: "RA Scraping Engine",   path: "/v2/ra-scraping" },
      { label: "Research",             path: "/v2/research" },
      { label: "Sorting",              path: "/v2/sorting" },
    ],
  },
  {
    title: "Agenti & Missioni",
    subGroups: [
      {
        title: "Agenti",
        items: [
          { label: "AI Staff Hub",         path: "/v2/ai-staff" },
          { label: "Agent Capabilities",   path: "/v2/agents/capabilities" },
          { label: "Agent Tasks",          path: "/v2/agents/tasks" },
          { label: "Editor Persona",       path: "/v2/agents/persona" },
        ],
      },
      {
        title: "Missioni",
        items: [
          { label: "Missioni Autopilot",   path: "/v2/agents/autopilot" },
          { label: "Mission Builder",      path: "/v2/agents/missions" },
          { label: "AI Arena 3D",          path: "/v2/ai-arena" },
        ],
      },
    ],
  },
  {
    title: "Email & Comunicazione",
    items: [
      { label: "Funnemail Hub",        path: "/v2/funnemail" },
      { label: "Mail Playground",      path: "/v2/funnemail/playground" },
      { label: "Statistiche mittenti", path: "/v2/funnemail/statistiche-mittenti" },
      { label: "Funnemail Sorting",    path: "/v2/funnemail-inbox/sorting" },
    ],
  },
  {
    title: "Agenda & Pipeline",
    items: [
      { label: "Calendar (deep-link)", path: "/v2/calendar" },
      { label: "Campaign Jobs",        path: "/v2/campaigns/jobs" },
    ],
  },
  {
    title: "Cockpit & Analytics",
    items: [
      { label: "AI Control Center",    path: "/v2/ai-control" },
      { label: "Analytics",            path: "/v2/analytics" },
      { label: "Dashboard",            path: "/v2/dashboard" },
      { label: "KPI Dashboard",        path: "/v2/kpi" },
      { label: "Notifications",        path: "/v2/notifications" },
    ],
  },
  {
    // Tutte le voci lab/prompt/observability vivono ora dentro /v2/lab.
    // Sorgente unica: src/v2/config/labTabs.ts (UNA riga per tab).
    title: "Lab & Verifiche (hub)",
    subGroups: [
      {
        title: "Hub",
        items: [
          { label: "Test & Prompts",       path: "/v2/lab?group=tests" },
          { label: "Observability",        path: "/v2/lab?group=observability" },
          { label: "Design System",        path: "/v2/lab?group=design" },
        ],
      },
      {
        title: "Test specifici",
        items: [
          { label: "Email Forge (Lab AI)", path: "/v2/email/forge" },
          { label: "KB Supervisor",        path: "/v2/ai-staff/kb-supervisor" },
        ],
      },
    ],
  },
  {
    title: "Sistema & Admin",
    items: [
      { label: "Admin Users",          path: "/v2/settings/admin-users" },
      { label: "AI Routing",           path: "/v2/settings/ai-routing" },
      { label: "Email Download",       path: "/v2/settings/email-download" },
      { label: "Finder API",           path: "/v2/finder-api" },
      { label: "Finder API Catalog",   path: "/v2/finder-api/schema" },
      { label: "Guida",                path: "/v2/guida" },
    ],
  },
] as const;

/**
 * Vista appiattita: tutti i path secondari (per validazione/test smoke).
 */
export const SECONDARY_NAV_PATHS: readonly string[] = SECONDARY_NAV.flatMap((g) => [
  ...(g.items ?? []).map((i) => i.path),
  ...(g.subGroups ?? []).flatMap((sg) => sg.items.map((i) => i.path)),
]);

/**
 * Helper: trova il gruppo cui appartiene un path (per evidenziare il gruppo
 * attivo nei popover/dropdown).
 */
export function findSecondaryNavGroup(path: string | null | undefined): string | null {
  if (!path) return null;
  for (const g of SECONDARY_NAV) {
    if ((g.items ?? []).some((i) => i.path === path)) return g.title;
    if ((g.subGroups ?? []).some((sg) => sg.items.some((i) => i.path === path))) return g.title;
  }
  return null;
}
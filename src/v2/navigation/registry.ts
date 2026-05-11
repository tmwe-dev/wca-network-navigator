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

export interface SecondaryNavGroup {
  readonly title: string;
  readonly items: readonly SecondaryNavItem[];
}

/**
 * SECONDARY_NAV — pagine dev/orfane, non nel menu principale ma scopribili
 * via popover, sezione "Tutte le pagine" e tab Development di Settings.
 *
 * Ordine: alfabetico dentro ogni gruppo, gruppi in ordine logico.
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
    items: [
      { label: "Agent Capabilities",   path: "/v2/agents/capabilities" },
      { label: "Agent Tasks",          path: "/v2/agents/tasks" },
      { label: "Editor Persona",       path: "/v2/agents/persona" },
      { label: "Mission Builder",      path: "/v2/agents/missions" },
      { label: "Missioni Autopilot",   path: "/v2/agents/autopilot" },
    ],
  },
  {
    title: "AI Staff",
    items: [
      { label: "AI Arena 3D",          path: "/v2/ai-arena" },
      { label: "Lab & Verifiche",      path: "/v2/lab" },
      { label: "AI Staff Hub",         path: "/v2/ai-staff" },
      { label: "KB Supervisor",        path: "/v2/ai-staff/kb-supervisor" },
    ],
  },
  {
    title: "Email & Comunicazione",
    items: [
      { label: "Email Forge (Lab AI)", path: "/v2/email/forge" },
      { label: "Funnemail Sorting",    path: "/v2/funnemail-inbox/sorting" },
    ],
  },
  {
    title: "Calendario & Campagne",
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
      { label: "Token Cockpit",        path: "/v2/token-cockpit" },
    ],
  },
  {
    title: "Prompt Lab Avanzato",
    items: [
      { label: "Agent Atlas",          path: "/v2/prompt-lab/atlas" },
      { label: "Prompt Catalog",       path: "/v2/prompt-lab/catalog" },
      { label: "Test Prompt",          path: "/v2/prompt-lab/tests" },
      { label: "Prompt Reader",        path: "/v2/settings/prompt-reader" },
      { label: "Proposals Review",     path: "/v2/prompt-lab/proposals" },
      { label: "Registro Interazioni AI", path: "/v2/ai-interactions-log" },
      { label: "Pipeline Traces",      path: "/v2/pipeline-traces" },
      { label: "Suggestions Review",   path: "/v2/prompt-lab/suggestions" },
    ],
  },
  {
    title: "Sistema & Admin",
    items: [
      { label: "Admin Users",          path: "/v2/settings/admin-users" },
      { label: "Alert Routing",        path: "/v2/settings/alert-routing" },
      { label: "Email Download",       path: "/v2/settings/email-download" },
      { label: "Finder API",           path: "/v2/finder-api" },
      { label: "Finder API Catalog",   path: "/v2/finder-api/schema" },
      { label: "Guida",                path: "/v2/guida" },
      { label: "System Health",        path: "/v2/settings/health" },
    ],
  },
] as const;

/**
 * Vista appiattita: tutti i path secondari (per validazione/test smoke).
 */
export const SECONDARY_NAV_PATHS: readonly string[] = SECONDARY_NAV.flatMap(
  (g) => g.items.map((i) => i.path),
);

/**
 * Helper: trova il gruppo cui appartiene un path (per evidenziare il gruppo
 * attivo nei popover/dropdown).
 */
export function findSecondaryNavGroup(path: string | null | undefined): string | null {
  if (!path) return null;
  for (const g of SECONDARY_NAV) {
    if (g.items.some((i) => i.path === path)) return g.title;
  }
  return null;
}
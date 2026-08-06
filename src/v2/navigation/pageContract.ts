/**
 * pageContract — Single Source of Truth per la SHELL di ogni maschera V2.
 *
 * Obiettivo (Ristrutturazione UX 2026-06): unificare il comportamento delle
 * pagine senza toccarne la logica. Da qui derivano:
 *   - SINISTRA  → quali FILTRI mostrare (ContextFiltersRail).
 *   - DESTRA    → se mostrare il rail WORKFLOW (azioni, processi, scorciatoie).
 *
 * Regole d'oro:
 *   - Una pagina senza filtri NON mostra la linguetta sinistra (niente rail vuota).
 *   - Una pagina senza workflow NON mostra la linguetta destra (niente pannello
 *     "Mission Control" generico fuori contesto).
 *
 * Aggiungere/spostare una pagina = UN solo edit qui.
 */
import type { SidebarContextKey } from "@/components/global/filters-drawer/sidebarContextRegistry";

/** Chiave del set di filtri da renderizzare nella sidebar sinistra. */
export type FilterKey =
  | "network"
  | "bca"
  | "crm-contacts"
  | "email-intelligence"
  | "email-compose"
  | "email-forge"
  | "agenda"
  | "campaigns"
  | "funnemail-inbox"
  | "sorting"
  | "arena";

/** Una regola di matching path → filtri (valutata in ordine, prima vince). */
export interface FilterRule {
  /** Predicato sul pathname corrente. */
  readonly match: (pathname: string, ctx: { networkView: "partners" | "bca" }) => boolean;
  /** Titolo mostrato nell'header della sidebar filtri. */
  readonly title: string;
  /** Set di filtri da renderizzare. */
  readonly filterKey: FilterKey;
  /** Banner contestuale (sidebarContextRegistry). */
  readonly bannerKey: SidebarContextKey;
}

/**
 * FILTER_RULES — ordinate. La prima che fa match definisce la sidebar sinistra.
 * Codifica esattamente le mappature storiche di ContextFiltersRail, ma come
 * DATI (testabili e modificabili in un solo punto).
 */
export const FILTER_RULES: readonly FilterRule[] = [
  {
    match: (p, ctx) =>
      ctx.networkView === "bca" &&
      (p.startsWith("/v2/explore/network") || p === "/v2/network" || p.startsWith("/v2/partner-hub")),
    title: "Filtri Biglietti BCA",
    filterKey: "bca",
    bannerKey: "bca",
  },
  {
    match: (p) => p.startsWith("/v2/explore/network") || p === "/v2/network" || p.startsWith("/v2/partner-hub"),
    title: "Filtri WCA Partner",
    filterKey: "network",
    bannerKey: "network",
  },
  {
    match: (p) =>
      p.startsWith("/v2/pipeline/contacts") ||
      p.startsWith("/v2/pipeline/kanban") ||
      p.startsWith("/v2/explore/contacts") ||
      p.startsWith("/v2/crm/contacts") ||
      p === "/v2/crm" ||
      p === "/v2/contacts",
    title: "Filtri Contatti CRM",
    filterKey: "crm-contacts",
    bannerKey: "crm-contacts",
  },
  {
    match: (p) => p.startsWith("/v2/pipeline/biglietti") || p.startsWith("/v2/explore/biglietti"),
    title: "Filtri Biglietti BCA",
    filterKey: "bca",
    bannerKey: "bca",
  },
  {
    match: (p) => p.startsWith("/v2/email-intelligence"),
    title: "Filtri Email Intelligence",
    filterKey: "email-intelligence",
    bannerKey: "email-intelligence",
  },
  {
    match: (p) => p.startsWith("/v2/communicate/compose"),
    title: "Configurazione Email AI",
    filterKey: "email-compose",
    bannerKey: "email-compose",
  },
  {
    match: (p) => p.startsWith("/v2/cockpit"),
    title: "Configurazione Email AI",
    filterKey: "email-compose",
    bannerKey: "email-compose",
  },
  {
    match: (p) =>
      p.startsWith("/v2/email/forge") || p.startsWith("/v2/email-forge") || p.startsWith("/v2/ai-staff/email-forge"),
    title: "Email Forge — Lab AI",
    filterKey: "email-forge",
    bannerKey: "email-forge",
  },
  {
    match: (p) => p.startsWith("/v2/agenda") || p.startsWith("/v2/pipeline/agenda"),
    title: "Filtri Agenda",
    filterKey: "agenda",
    bannerKey: "agenda",
  },
  {
    match: (p) => p.startsWith("/v2/campaigns"),
    title: "Filtri Campagne",
    filterKey: "campaigns",
    bannerKey: "campaigns",
  },
  {
    match: (p) => p.startsWith("/v2/funnemail-inbox") || p.startsWith("/v2/inbox"),
    title: "Filtri Funnemail",
    filterKey: "funnemail-inbox",
    bannerKey: "funnemail-inbox",
  },
  {
    match: (p) => p.startsWith("/v2/sorting"),
    title: "Filtri Approvazioni",
    filterKey: "sorting",
    bannerKey: "sorting",
  },
  {
    match: (p) => p.startsWith("/v2/ai-arena"),
    title: "AI Arena — Focus",
    filterKey: "arena",
    bannerKey: "arena",
  },
];

/** Risolve la regola filtri attiva per un pathname (o null se nessuna). */
export function resolveFilterRule(pathname: string, networkView: "partners" | "bca"): FilterRule | null {
  for (const rule of FILTER_RULES) {
    if (rule.match(pathname, { networkView })) return rule;
  }
  return null;
}

/**
 * WORKFLOW_PATHS — pagine in cui ha senso mostrare il rail DESTRO (workflow:
 * azioni rapide, missioni, suggerimenti, scorciatoie). Altrove la linguetta
 * destra resta nascosta per non mostrare il generico "Mission Control".
 */
const WORKFLOW_MATCHERS: ReadonlyArray<(p: string) => boolean> = [
  (p) => p.startsWith("/v2/explore"), // network, mappa, sherlock
  (p) => p === "/v2/network",
  (p) => p === "/v2/crm" || p.startsWith("/v2/crm/") || p.startsWith("/v2/explore/contacts"),
  (p) => p === "/v2/outreach" || p.startsWith("/v2/communicate/outreach"),
  (p) => p === "/v2/email-composer" || p.startsWith("/v2/communicate/compose"),
  (p) => p === "/v2/settings" || p.startsWith("/v2/settings/"),
  (p) => p.startsWith("/v2/cockpit"),
];

/** True se la pagina corrente deve esporre il rail workflow a destra. */
export function pageHasWorkflow(pathname: string): boolean {
  return WORKFLOW_MATCHERS.some((m) => m(pathname));
}

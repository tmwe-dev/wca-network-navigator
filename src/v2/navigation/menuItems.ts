/**
 * menuItems — UNICO elenco piatto delle maschere del sistema.
 *
 * Regola (2026-08-31): un solo menu, nessun raggruppamento.
 * L'ordine di default parte dalle voci che erano nel menu principale,
 * seguite da tutte le altre maschere raggiungibili. L'utente può
 * riordinare le voci (su/giù) e l'ordine viene memorizzato.
 */

export type MenuStato = "attiva" | "sviluppo";

export interface MenuItemDef {
  /** Identificatore stabile = path della maschera. */
  readonly path: string;
  readonly label: string;
  readonly stato: MenuStato;
}

/** Voci storicamente presenti nel menu principale: restano in cima. */
const PRINCIPALI: readonly MenuItemDef[] = [
  { path: "/v2/command", label: "Command", stato: "attiva" },
  { path: "/v2/agents/autopilot", label: "Missioni Autopilot", stato: "attiva" },
  { path: "/v2/explore/network", label: "Esplora Network", stato: "attiva" },
  { path: "/v2/cestinone", label: "Cestinone", stato: "attiva" },
  { path: "/v2/cockpit", label: "Cockpit", stato: "attiva" },
  { path: "/v2/comms", label: "Comms", stato: "attiva" },
  { path: "/v2/inbox", label: "Inbox", stato: "attiva" },
  { path: "/v2/email", label: "Email", stato: "attiva" },
  { path: "/v2/agenda", label: "Agenda", stato: "attiva" },
  { path: "/v2/lab", label: "Lab", stato: "attiva" },
  { path: "/v2/email-intelligence", label: "Email Intelligence", stato: "attiva" },
  { path: "/v2/rubrica/whatsapp", label: "Rubrica WhatsApp", stato: "attiva" },
  { path: "/v2/rubrica/linkedin", label: "Rubrica LinkedIn", stato: "attiva" },
  { path: "/v2/intelligence/agents", label: "Agenti", stato: "attiva" },
  { path: "/v2/settings", label: "Config", stato: "attiva" },
];

/** Maschere operative finora nascoste nei sotto-menu. */
const OPERATIVE: readonly MenuItemDef[] = [
  { path: "/v2/contacts", label: "Contatti", stato: "attiva" },
  { path: "/v2/explore/map", label: "Mappa Globo", stato: "attiva" },
  { path: "/v2/explore/contacts", label: "Contatti (Esplora)", stato: "attiva" },
  { path: "/v2/explore/biglietti", label: "Biglietti da Visita", stato: "attiva" },
  { path: "/v2/explore/deep-search", label: "Deep Search", stato: "attiva" },
  { path: "/v2/explore/campaigns", label: "Campagne (Esplora)", stato: "attiva" },
  { path: "/v2/agenda/reparti", label: "Reparti", stato: "attiva" },
  { path: "/v2/agenda/pipeline", label: "Pipeline Kanban", stato: "attiva" },
  { path: "/v2/agenda/duplicati", label: "Duplicati", stato: "attiva" },
  { path: "/v2/crm/acquisition", label: "Acquisizione Partner", stato: "attiva" },
  { path: "/v2/crm/prospects", label: "Prospects", stato: "attiva" },
  { path: "/v2/research", label: "Research", stato: "attiva" },
  { path: "/v2/sorting", label: "Sorting", stato: "attiva" },
  { path: "/v2/ra-explorer", label: "RA Explorer", stato: "attiva" },
  { path: "/v2/ra-scraping", label: "RA Scraping Engine", stato: "attiva" },
  { path: "/v2/partner-hub", label: "Partner Hub", stato: "attiva" },
  { path: "/v2/analytics", label: "Analytics", stato: "attiva" },
  { path: "/v2/kpi", label: "KPI Dashboard", stato: "attiva" },
  { path: "/v2/notifications", label: "Notifiche", stato: "attiva" },
  { path: "/v2/campaigns/jobs", label: "Campaign Jobs", stato: "attiva" },
  { path: "/v2/funnemail-inbox", label: "Funnemail", stato: "attiva" },
  { path: "/v2/funnemail-inbox/sorting", label: "Funnemail Sorting", stato: "attiva" },
  { path: "/v2/email-intelligence/operations", label: "Email Operations", stato: "attiva" },
  { path: "/v2/approvazioni", label: "Approvazioni Invii", stato: "attiva" },
  { path: "/v2/agents/overview", label: "Chi fa cosa", stato: "attiva" },
  { path: "/v2/agents/persona", label: "Editor Persona", stato: "attiva" },
  { path: "/v2/agents/capabilities", label: "Agent Capabilities", stato: "attiva" },
  { path: "/v2/agents/tasks", label: "Agent Tasks", stato: "attiva" },
  { path: "/v2/agents/email-strategies", label: "Strategie Email", stato: "attiva" },
  { path: "/v2/agents/missions", label: "Mission Builder", stato: "attiva" },
  { path: "/v2/ai-staff", label: "AI Staff Hub", stato: "attiva" },
  { path: "/v2/brain", label: "Cervello", stato: "attiva" },
  { path: "/v2/tmwe/clients", label: "Clienti TMWE", stato: "attiva" },
  { path: "/v2/command/help", label: "Guida Command", stato: "attiva" },
  { path: "/v2/docs", label: "Documentazione", stato: "attiva" },
  { path: "/v2/dpa", label: "DPA / Privacy", stato: "attiva" },
];

/** Maschere in via di sviluppo / diagnostica / legacy. */
const IN_SVILUPPO: readonly MenuItemDef[] = [
  { path: "/v2/ai-control", label: "AI Control Center", stato: "sviluppo" },
  { path: "/v2/ai-arena", label: "AI Arena 3D", stato: "sviluppo" },
  { path: "/v2/ai-staff/kb-supervisor", label: "KB Supervisor", stato: "sviluppo" },
  { path: "/v2/email/forge", label: "Email Forge", stato: "sviluppo" },
  { path: "/v2/galaxy", label: "Galassia di Sistema", stato: "sviluppo" },
  { path: "/v2/finder-api", label: "Finder API", stato: "sviluppo" },
  { path: "/v2/finder-api/schema", label: "Finder API Catalog", stato: "sviluppo" },
  { path: "/v2/guida", label: "Guida", stato: "sviluppo" },
  { path: "/v2/dashboard", label: "Dashboard (legacy)", stato: "sviluppo" },
  { path: "/v2/calendar", label: "Calendar (legacy)", stato: "sviluppo" },
  { path: "/v2/settings/admin-users", label: "Admin Users", stato: "sviluppo" },
  { path: "/v2/settings/ai-routing", label: "AI Routing", stato: "sviluppo" },
  { path: "/v2/settings/email-download", label: "Email Download", stato: "sviluppo" },
];

/** Elenco piatto completo, nell'ordine di default. */
export const MENU_ITEMS: readonly MenuItemDef[] = [...PRINCIPALI, ...OPERATIVE, ...IN_SVILUPPO];

export const MENU_ITEM_BY_PATH: ReadonlyMap<string, MenuItemDef> = new Map(MENU_ITEMS.map((i) => [i.path, i]));

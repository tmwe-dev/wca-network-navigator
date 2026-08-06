/**
 * navMenuConfig — Dati statici del NavMenuPopover.
 *
 * Estratto dal componente per mantenere il file UI sotto controllo.
 * Zero logica: solo tabelle di mapping "sezione principale → sotto-voci"
 * e helper puri per la radice di sezione.
 */
import type { SecondaryNavGroup } from "@/v2/navigation/registry";

/**
 * Mappa pagine principali con sotto-cartelle navigabili inline nel popover
 * (stesso comportamento di "Development").
 */
export const EXPANDABLE_MAIN_NAV: Record<string, readonly SecondaryNavGroup[]> = {
  // Config → tab della pagina /v2/settings
  "/v2/settings": [
    {
      title: "Generali",
      items: [
        { label: "Generale", path: "/v2/settings?tab=generale" },
        { label: "Connessioni", path: "/v2/settings?tab=wca" },
        { label: "Estensioni", path: "/v2/settings?tab=estensioni" },
        { label: "Report Aziende", path: "/v2/settings?tab=reportaziende" },
        { label: "Notifiche", path: "/v2/settings?tab=notifiche" },
        { label: "Timing & Schedule", path: "/v2/settings?tab=timing" },
      ],
    },
    {
      title: "Agenti",
      items: [
        { label: "Voce AI", path: "/v2/settings?tab=voce-ai" },
        { label: "AI & Prompt", path: "/v2/settings?tab=ai-prompt" },
        { label: "Provider AI", path: "/v2/settings?tab=provider-ai" },
      ],
    },
    { title: "Update", items: [{ label: "Arricchimento", path: "/v2/settings?tab=enrichment" }] },
    {
      title: "Import & Export",
      items: [
        { label: "Backup & Export", path: "/v2/settings?tab=backup-export" },
        { label: "Importa", path: "/v2/settings?tab=import-export" },
      ],
    },
    {
      title: "Contatori",
      items: [
        { label: "AI Monitor", path: "/v2/settings?tab=ai-monitor" },
        { label: "Processi Automatici", path: "/v2/settings?tab=processi-automatici" },
        { label: "Token AI", path: "/v2/settings?tab=token-ai" },
        { label: "Memoria AI", path: "/v2/settings?tab=memoria-ai" },
      ],
    },
    {
      title: "Report",
      items: [
        { label: "Audit Trail", path: "/v2/settings?tab=audit" },
        { label: "Jobs Operativi", path: "/v2/settings?tab=guida-operativa" },
      ],
    },
    {
      title: "Posta",
      items: [
        { label: "Download Email", path: "/v2/settings?tab=download-email" },
        { label: "Caselle Aziendali", path: "/v2/settings?tab=caselle-aziendali" },
      ],
    },
    { title: "Master", items: [{ label: "Development", path: "/v2/settings?tab=development" }] },
    { title: "TEST", items: [{ label: "Lab & Verifiche", path: "/v2/settings?tab=lab" }] },
    {
      title: "Team",
      items: [
        { label: "Operatori", path: "/v2/settings?tab=operatori" },
        { label: "Ruoli & Permessi", path: "/v2/settings?tab=ruoli" },
        { label: "Ruoli Utenti", path: "/v2/settings?tab=ruoli-utenti" },
        { label: "Utenti Autorizzati", path: "/v2/settings?tab=utenti" },
        { label: "Team", path: "/v2/settings?tab=team" },
      ],
    },
    {
      title: "Sistema avanzato",
      items: [
        { label: "Admin Users", path: "/v2/settings/admin-users" },
        { label: "AI Routing", path: "/v2/settings/ai-routing" },
        { label: "Email Download", path: "/v2/settings/email-download" },
      ],
    },
  ],
  // Cervello → Agenti: gestione, persona, capacità, task, strategie
  "/v2/intelligence/agents": [
    {
      title: "Gestione Agenti",
      items: [
        { label: "Chi fa cosa", path: "/v2/agents/overview" },
        { label: "Editor Persona", path: "/v2/agents/persona" },
        { label: "Agent Capabilities", path: "/v2/agents/capabilities" },
        { label: "Agent Tasks", path: "/v2/agents/tasks" },
        { label: "Strategie Email", path: "/v2/agents/email-strategies" },
        { label: "AI Staff Hub", path: "/v2/ai-staff" },
      ],
    },
  ],
  // Comando → Missioni Autopilot: builder missioni
  "/v2/agents/autopilot": [{ title: "Missioni", items: [{ label: "Mission Builder", path: "/v2/agents/missions" }] }],
  // Esplora → acquisizione & ricerca lead
  "/v2/explore/network": [
    {
      title: "Acquisizione & Ricerca",
      items: [
        { label: "Acquisizione Partner", path: "/v2/crm/acquisition" },
        { label: "Prospects", path: "/v2/crm/prospects" },
        { label: "Research", path: "/v2/research" },
        { label: "Sorting", path: "/v2/sorting" },
        { label: "RA Explorer", path: "/v2/ra-explorer" },
        { label: "RA Scraping Engine", path: "/v2/ra-scraping" },
      ],
    },
  ],
  // Pipeline → Cockpit: analytics, KPI, notifiche
  "/v2/cockpit": [
    {
      title: "Analytics & Report",
      items: [
        { label: "Analytics", path: "/v2/analytics" },
        { label: "KPI Dashboard", path: "/v2/kpi" },
        { label: "Notifications", path: "/v2/notifications" },
      ],
    },
  ],
  // Pipeline → Agenda: campagne
  "/v2/agenda": [{ title: "Campagne", items: [{ label: "Campaign Jobs", path: "/v2/campaigns/jobs" }] }],
  // Comunica → Funnemail: sorting
  "/v2/funnemail-inbox": [
    { title: "Funnemail", items: [{ label: "Funnemail Sorting", path: "/v2/funnemail-inbox/sorting" }] },
  ],
};

/** Estrae la radice di sezione: `/v2/intelligence/agents` → `/v2/intelligence`. */
export function sectionRoot(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) return "/v2";
  return `/${parts[0]}/${parts[1]}`;
}

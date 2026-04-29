/**
 * FiltersDrawer constants - estratti per ridurre la dimensione del monolite.
 * Mantengono la stessa shape dell'originale per zero behavioural diff.
 */
import { ListTodo, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import type {
  WorkspaceFilterKey,
  EmailGenFilter,
  SortingFilterMode,
  CockpitChannelFilter,
  CockpitQualityFilter,
} from "@/contexts/GlobalFiltersContext";

export const COCKPIT_SORT = [
  { value: "name", label: "Nome" },
  { value: "country", label: "Paese" },
  { value: "priority", label: "Priorità" },
  { value: "lastContact", label: "Ultimo" },
  { value: "company", label: "Azienda" },
];

export const COCKPIT_ORIGIN = [
  { value: "wca", label: "WCA" },
  { value: "import", label: "Import" },
  { value: "report_aziende", label: "RA" },
  { value: "bca", label: "BCA" },
];

export const COCKPIT_CHANNEL: { key: CockpitChannelFilter; label: string; icon: string }[] = [
  { key: "with_email", label: "Email", icon: "📧" },
  { key: "with_linkedin", label: "LinkedIn", icon: "🔗" },
  { key: "with_phone", label: "Telefono", icon: "📱" },
  { key: "with_whatsapp", label: "WhatsApp", icon: "💬" },
];

export const COCKPIT_QUALITY: { key: CockpitQualityFilter; label: string }[] = [
  { key: "enriched", label: "Arricchiti" },
  { key: "not_enriched", label: "Non arricchiti" },
  { key: "with_alias", label: "Con alias" },
  { key: "no_alias", label: "Senza alias" },
];

// Tassonomia 9 stati — Cockpit mostra solo gli stati operativi (no terminali)
export const COCKPIT_STATUS = [
  { value: "all", label: "Tutti" },
  { value: "new", label: "Nuovo" },
  { value: "first_touch_sent", label: "Primo contatto" },
  { value: "holding", label: "In attesa" },
  { value: "engaged", label: "Agganciato" },
  { value: "negotiation", label: "Trattativa" },
];

export const FLAG: Record<string, string> = {
  IT: "🇮🇹", GB: "🇬🇧", FR: "🇫🇷", DE: "🇩🇪", ES: "🇪🇸", JP: "🇯🇵", RU: "🇷🇺", US: "🇺🇸",
  CN: "🇨🇳", BR: "🇧🇷", NL: "🇳🇱", BE: "🇧🇪", CH: "🇨🇭", AT: "🇦🇹", PT: "🇵🇹", PL: "🇵🇱",
  TR: "🇹🇷", IN: "🇮🇳", AE: "🇦🇪", SA: "🇸🇦", KR: "🇰🇷", AU: "🇦🇺", CA: "🇨🇦", MX: "🇲🇽",
};

export const ATTIVITA_STATUS = [
  { value: "all", label: "Tutte", icon: ListTodo },
  { value: "pending", label: "In attesa", icon: Clock },
  { value: "holding", label: "In attesa", icon: AlertTriangle },
  { value: "completed", label: "Completate", icon: CheckCircle2 },
];

export const ATTIVITA_PRIORITY = [
  { value: "all", label: "Tutte" },
  { value: "urgent", label: "🔴 Urgente" },
  { value: "high", label: "🟠 Alta" },
  { value: "medium", label: "🟡 Media" },
  { value: "low", label: "🟢 Bassa" },
];

export const EMAIL_CATEGORIES = [
  { value: "all", label: "Tutte" },
  { value: "primary", label: "Principale" },
  { value: "notification", label: "Notifiche" },
  { value: "marketing", label: "Marketing" },
  { value: "spam", label: "Spam" },
];

export const EMAIL_SORT = [
  { value: "date_desc", label: "Più recenti" },
  { value: "date_asc", label: "Più vecchi" },
];

export const WS_CHIPS: { key: WorkspaceFilterKey; label: string }[] = [
  { key: "with_email", label: "Con email" },
  { key: "no_email", label: "No email" },
  { key: "with_contact", label: "Con contatto" },
  { key: "no_contact", label: "No contatto" },
  { key: "enriched", label: "Arricchito" },
  { key: "not_enriched", label: "Non arricchito" },
];

export const EMAIL_GEN: { key: EmailGenFilter; label: string }[] = [
  { key: "all", label: "Tutte" },
  { key: "generated", label: "Generata" },
  { key: "to_generate", label: "Da generare" },
];

export const SORTING_FILTERS: { key: SortingFilterMode; label: string }[] = [
  { key: "all", label: "Tutti" },
  { key: "immediate", label: "⚡ Imm." },
  { key: "scheduled", label: "🕐 Prog." },
  { key: "unreviewed", label: "Da rivedere" },
  { key: "reviewed", label: "Rivisti" },
];

export const NETWORK_SORT = [
  { value: "name", label: "Nome" },
  { value: "rating", label: "Rating" },
  { value: "recent", label: "Più recenti" },
];

export const NETWORK_QUALITY = [
  { value: "all", label: "Tutti" },
  { value: "with_email", label: "📧 Con email" },
  { value: "with_phone", label: "📱 Con tel" },
  { value: "with_profile", label: "🔗 Con profilo" },
  { value: "no_email", label: "❌ Senza email" },
  { value: "no_contacts", label: "👤 Senza contatti" },
];

export const CRM_GROUPBY = [
  { value: "country", label: "Paese" },
  { value: "origin", label: "Origine" },
  { value: "status", label: "Stato" },
  { value: "date", label: "Mese" },
];

export const CRM_SORT = [
  { value: "company", label: "Azienda" },
  { value: "name", label: "Contatto" },
  { value: "country", label: "Paese" },
  { value: "city", label: "Città" },
  { value: "recent", label: "Più recenti" },
];

export const CRM_ORIGIN = [
  { value: "wca", label: "WCA" },
  { value: "import", label: "Import" },
  { value: "report_aziende", label: "RA" },
  { value: "bca", label: "BCA" },
];

// Tassonomia 9 stati — CRM mostra 7 stati (esclusi blacklisted e negotiation interno cockpit)
export const CRM_LEAD_STATUS = [
  { value: "all", label: "Tutti" },
  { value: "new", label: "Nuovo" },
  { value: "first_touch_sent", label: "Primo contatto" },
  { value: "holding", label: "In attesa" },
  { value: "engaged", label: "Agganciato" },
  { value: "qualified", label: "Qualificato" },
  { value: "converted", label: "Convertito" },
  { value: "archived", label: "Archiviato" },
];

export const CRM_HOLDING = [
  { value: "out", label: "Fuori" },
  { value: "in", label: "In" },
  { value: "all", label: "Tutti" },
];

export const CRM_QUALITY = [
  { value: "all", label: "Tutti" },
  { value: "enriched", label: "Arricchiti" },
  { value: "not_enriched", label: "Non arricchiti" },
  { value: "with_alias", label: "Con alias" },
  { value: "no_alias", label: "Senza alias" },
];

export const CRM_CHANNEL = [
  { value: "all", label: "Tutti" },
  { value: "with_email", label: "📧 Email" },
  { value: "with_phone", label: "📱 Tel" },
  { value: "with_linkedin", label: "🔗 LI" },
  { value: "with_whatsapp", label: "💬 WA" },
];

import { cn } from "@/lib/utils";
import type { CockpitChannelFilter, CockpitQualityFilter, WorkspaceFilterKey, EmailGenFilter, SortingFilterMode } from "@/contexts/GlobalFiltersContext";

/* ── Shared UI Primitives ── */

export function FilterSection({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1.5">
        <Icon className="w-3 h-3" /> {label}
      </label>
      {children}
    </div>
  );
}

export function ChipGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1">{children}</div>;
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border flex items-center gap-1",
        active
          ? "bg-primary/15 border-primary/30 text-primary shadow-sm shadow-primary/5"
          : "border-border/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/* ── Constants ── */

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

export const COCKPIT_STATUS = [
  { value: "all", label: "Tutti" },
  { value: "new", label: "Nuovo" },
  { value: "contacted", label: "Contattato" },
  { value: "in_progress", label: "In corso" },
  { value: "negotiation", label: "Trattativa" },
];

export const FLAG: Record<string, string> = {
  IT: "🇮🇹", GB: "🇬🇧", FR: "🇫🇷", DE: "🇩🇪", ES: "🇪🇸", JP: "🇯🇵", RU: "🇷🇺", US: "🇺🇸",
  CN: "🇨🇳", BR: "🇧🇷", NL: "🇳🇱", BE: "🇧🇪", CH: "🇨🇭", AT: "🇦🇹", PT: "🇵🇹", PL: "🇵🇱",
  TR: "🇹🇷", IN: "🇮🇳", AE: "🇦🇪", SA: "🇸🇦", KR: "🇰🇷", AU: "🇦🇺", CA: "🇨🇦", MX: "🇲🇽",
};

export const ATTIVITA_STATUS = [
  { value: "all", label: "Tutte", icon: "ListTodo" },
  { value: "pending", label: "In attesa", icon: "Clock" },
  { value: "in_progress", label: "In corso", icon: "AlertTriangle" },
  { value: "completed", label: "Completate", icon: "CheckCircle2" },
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
  { value: "contacts", label: "Contatti" },
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
  { value: "lead_status", label: "Stato" },
  { value: "import_group", label: "Gruppo" },
];

export const CRM_SORT = [
  { value: "name", label: "Nome" },
  { value: "country", label: "Paese" },
  { value: "company", label: "Azienda" },
  { value: "date_desc", label: "Più recenti" },
  { value: "interaction", label: "Ultimo contatto" },
];

export const CRM_ORIGIN = [
  { value: "wca", label: "WCA" },
  { value: "import", label: "Import" },
  { value: "report_aziende", label: "RA" },
  { value: "bca", label: "BCA" },
];

export const CRM_LEAD_STATUS = [
  { value: "all", label: "Tutti" },
  { value: "new", label: "Nuovo" },
  { value: "contacted", label: "Contattato" },
  { value: "qualified", label: "Qualificato" },
  { value: "converted", label: "Convertito" },
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

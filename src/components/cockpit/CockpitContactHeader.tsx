import { CreditCard, Sparkles, ChevronDown, ChevronUp, Mail, Linkedin, Phone, CalendarClock, Reply } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import type { ContactOrigin } from "@/types/cockpit";

interface Contact {
  name: string;
  company: string;
  role: string;
  origin: ContactOrigin;
  originDetail: string;
  priority: number;
  deepSearchAt?: string;
  enrichmentData?: Record<string, unknown>;
  memberYears?: number;
  seniority?: string;
  networks?: string[];
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  country?: string;
}

const priorityColor = (p: number) => {
  if (p >= 9) return "bg-destructive/20 text-destructive border-destructive/30";
  if (p >= 7) return "bg-warning/20 text-warning border-warning/30";
  if (p >= 5) return "bg-primary/20 text-primary border-primary/30";
  return "bg-muted text-muted-foreground border-border";
};

const originConfig: Record<ContactOrigin, { label: string; bg: string; text: string; border: string; dot: string }> = {
  wca: { label: "WCA", bg: "bg-chart-1/15", text: "text-chart-1", border: "border-chart-1/30", dot: "bg-chart-1" },
  report_aziende: { label: "RA", bg: "bg-chart-4/15", text: "text-chart-4", border: "border-chart-4/30", dot: "bg-chart-4" },
  import: { label: "Import", bg: "bg-chart-3/15", text: "text-chart-3", border: "border-chart-3/30", dot: "bg-chart-3" },
  bca: { label: "BCA", bg: "bg-primary/15", text: "text-primary", border: "border-primary/30", dot: "bg-primary" },
  manual: { label: "Manuale", bg: "bg-emerald-500/15", text: "text-emerald-500", border: "border-emerald-500/30", dot: "bg-emerald-500" },
};

interface CockpitContactHeaderProps {
  contact: Contact;
  isExpanded: boolean;
  isWorked?: boolean;
  hasAnyData: boolean;
  onToggleExpand: () => void;
  contactHeadline?: string;
}

export function CockpitContactHeader({
  contact, isExpanded, isWorked, hasAnyData, onToggleExpand, contactHeadline,
}: CockpitContactHeaderProps) {
  const oc = originConfig[contact.origin];

  // Detect "tipo azione" dall'originDetail (es. "📅 Riprogrammato", "Risposta a email ricevuta")
  const detail = contact.originDetail || "";
  const isReply = /risposta/i.test(detail);
  const isScheduled = /riprogrammat|schedul|📅/i.test(detail);
  const ActionIcon = isReply ? Reply : isScheduled ? CalendarClock : Mail;
  const actionLabel = isReply ? "Risposta" : isScheduled ? "Riprogrammato" : "Azione";

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {/* Riga 1: NOME persona — il dato più importante */}
          <div className="flex items-center gap-1.5">
            {contact.origin === "bca" && <CreditCard className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
            <span className="text-[15px] font-bold text-foreground truncate leading-tight">
              {contact.name && contact.name !== "—" ? contact.name : (contact.company || "Contatto")}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
              className={cn("flex items-center gap-0.5 rounded-md p-0.5 transition-colors", hasAnyData ? "hover:bg-primary/10" : "hover:bg-muted/50")}
              aria-label={isExpanded ? "Comprimi" : "Espandi"}
            >
              {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
            </button>
          </div>
          {/* Riga 2: AZIENDA · paese */}
          <div className="flex items-center gap-1.5 text-xs text-foreground/85 truncate">
            <span className="truncate font-medium">{contact.company}</span>
            {contact.country && <span className="text-muted-foreground/70 text-[10px] uppercase tracking-wide">· {contact.country}</span>}
          </div>
          {contact.role && <div className="text-[11px] text-muted-foreground truncate">{contact.role}</div>}

          {/* Riga 3: TIPO AZIONE — icona + label invece di "Risposta email: ..." */}
          <div className="mt-1 flex items-center gap-1.5">
            <span className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
              isReply ? "bg-primary/15 text-primary" : isScheduled ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
            )}>
              <ActionIcon className="w-3 h-3" />
              {actionLabel}
            </span>
            {contactHeadline && (
              <span className="text-[10px] text-muted-foreground truncate">· {contactHeadline}</span>
            )}
          </div>

          {/* Riga 4: RIFERIMENTI a colpo d'occhio — chip per email/tel/LinkedIn quando presenti */}
          {(contact.email || contact.phone || contact.linkedinUrl) && (
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              {contact.email && (
                <InfoTooltip content={contact.email}>
                  <span className="inline-flex items-center gap-1 rounded bg-primary/8 text-primary text-[10px] px-1.5 py-0.5 max-w-[160px] truncate">
                    <Mail className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{contact.email}</span>
                  </span>
                </InfoTooltip>
              )}
              {contact.phone && (
                <InfoTooltip content={contact.phone}>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-600 text-[10px] px-1.5 py-0.5">
                    <Phone className="w-2.5 h-2.5 shrink-0" />
                    {contact.phone}
                  </span>
                </InfoTooltip>
              )}
              {contact.linkedinUrl && (
                <InfoTooltip content="LinkedIn disponibile">
                  <span className="inline-flex items-center gap-1 rounded bg-[hsl(210,80%,55%)]/10 text-[hsl(210,80%,55%)] text-[10px] px-1.5 py-0.5">
                    <Linkedin className="w-2.5 h-2.5 shrink-0" />
                    LinkedIn
                  </span>
                </InfoTooltip>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-1">
            {hasAnyData && (
              <InfoTooltip content="Enrichment AI completato">
                <span className="p-0.5 rounded bg-primary/10"><Sparkles className="w-3 h-3 text-primary" /></span>
              </InfoTooltip>
            )}
            <InfoTooltip content={`Origine: ${contact.originDetail}`}>
              <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-md border flex items-center gap-1", oc.bg, oc.text, oc.border)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", oc.dot)} />
                {oc.label}
              </span>
            </InfoTooltip>
          </div>
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", priorityColor(contact.priority))}>
            P{contact.priority}
          </span>
          {isWorked && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md border bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
              ✓ Fatto
            </span>
          )}
        </div>
      </div>

      {(contact.memberYears != null || contact.seniority || (contact.networks && contact.networks.length > 0)) && (
        <div className="flex items-center gap-1 flex-wrap">
          {contact.memberYears != null && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              {contact.memberYears}a membro
            </span>
          )}
          {contact.seniority && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-chart-3/10 text-chart-3 border border-chart-3/20">
              {contact.seniority}
            </span>
          )}
          {contact.networks?.map(n => (
            <span key={n} className="text-[9px] px-1 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/30">
              {n}
            </span>
          ))}
        </div>
      )}

    </>
  );
}

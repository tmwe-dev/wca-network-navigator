import { motion } from "framer-motion";
import { GripVertical, Mail, Linkedin, MessageCircle, Smartphone, Search, Sparkles, CreditCard, Briefcase } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { resolveAgentAvatar } from "@/data/agentAvatars";
import type { ContactOrigin } from "@/pages/Cockpit";

interface Contact {
  id: string;
  name: string;
  company: string;
  role: string;
  country: string;
  language: string;
  lastContact: string;
  priority: number;
  channels: string[];
  email: string;
  phone?: string;
  linkedinUrl?: string;
  origin: ContactOrigin;
  originDetail: string;
}

export interface EnrichmentState {
  isActive: boolean;
  scrapingPhase: "idle" | "visiting" | "extracting" | "enriching" | "reviewing" | "generating";
  linkedinProfile?: {
    name?: string;
    headline?: string;
    location?: string;
    connectionStatus?: string;
  } | null;
}

export interface AssignmentInfo {
  agentName: string;
  agentAvatar?: string;
  managerName?: string;
}

interface CockpitContactCardProps {
  contact: Contact;
  flag: string;
  index: number;
  isSelected: boolean;
  isWorked?: boolean;
  assignment?: AssignmentInfo;
  onToggleSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDeepSearch: () => void;
  onAlias: () => void;
  enrichmentState?: EnrichmentState;
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
  bca: { label: "BCA", bg: "bg-amber-500/15", text: "text-amber-500", border: "border-amber-500/30", dot: "bg-amber-500" },
  manual: { label: "Manuale", bg: "bg-emerald-500/15", text: "text-emerald-500", border: "border-emerald-500/30", dot: "bg-emerald-500" },
};

const originAccent: Record<ContactOrigin, string> = {
  wca: "from-chart-1/60 to-chart-1/10",
  report_aziende: "from-chart-4/60 to-chart-4/10",
  import: "from-chart-3/60 to-chart-3/10",
  bca: "from-amber-500/60 to-amber-500/10",
  manual: "from-emerald-500/60 to-emerald-500/10",
};

const phaseLabel: Record<string, string> = {
  visiting: "🔍 Visita profilo...",
  extracting: "📋 Estrazione dati...",
  enriching: "🧠 Arricchimento...",
  reviewing: "👁️ In revisione",
  generating: "✨ Generazione messaggio...",
};

// Smart channel icon: active only if real data exists
function SmartChannelIcons({ contact }: { contact: Contact }) {
  const hasEmail = !!contact.email;
  const hasLinkedin = !!contact.linkedinUrl;
  const hasPhone = !!contact.phone;

  const icons = [
    { key: "email", Icon: Mail, active: hasEmail, activeClass: "text-primary bg-primary/10" },
    { key: "linkedin", Icon: Linkedin, active: hasLinkedin, activeClass: "text-[hsl(210,80%,55%)] bg-[hsl(210,80%,55%)]/10" },
    { key: "whatsapp", Icon: MessageCircle, active: hasPhone, activeClass: "text-emerald-500 bg-emerald-500/10" },
    { key: "sms", Icon: Smartphone, active: hasPhone, activeClass: "text-chart-3 bg-chart-3/10" },
  ];

  return (
    <div className="flex items-center gap-1">
      {icons.map(({ key, Icon, active, activeClass }) => (
        <span
          key={key}
          className={cn(
            "p-1 rounded-md transition-colors",
            active ? activeClass : "bg-muted/30 text-muted-foreground/25"
          )}
          title={active ? `${key} disponibile` : `${key} mancante`}
        >
          <Icon className="w-3 h-3" />
        </span>
      ))}
    </div>
  );
}

export function CockpitContactCard({ contact, flag, index, isSelected, isWorked, onToggleSelect, onDragStart, onDragEnd, onDeepSearch, onAlias, enrichmentState }: CockpitContactCardProps) {
  const oc = originConfig[contact.origin];
  const isProcessing = enrichmentState?.isActive && enrichmentState.scrapingPhase !== "idle";
  const hasLinkedin = enrichmentState?.linkedinProfile && (enrichmentState.scrapingPhase === "reviewing" || enrichmentState.scrapingPhase === "generating" || enrichmentState.scrapingPhase === "idle");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      draggable={!isProcessing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      whileHover={isProcessing ? {} : { scale: 1.02, y: -2 }}
      whileTap={isProcessing ? {} : { scale: 0.98 }}
      className={cn(
        "group relative rounded-xl border bg-card backdrop-blur-xl p-3.5 transition-all duration-300 hover:shadow-lg overflow-hidden",
        isProcessing
          ? "border-[hsl(210,80%,55%)]/40 bg-[hsl(210,80%,55%)]/[0.03] shadow-sm shadow-[hsl(210,80%,55%)]/5 cursor-default animate-soft-pulse"
          : isWorked
          ? "border-emerald-500/60 bg-emerald-500/5 cursor-grab active:cursor-grabbing"
          : "cursor-grab active:cursor-grabbing",
        !isProcessing && !isWorked && (
          contact.origin === "bca"
            ? isSelected
              ? "border-amber-500/60 bg-amber-500/5 shadow-md shadow-amber-500/10 hover:shadow-amber-500/10"
              : "border-amber-500/30 hover:border-amber-500/50 hover:shadow-amber-500/5"
            : isSelected
              ? "border-primary/60 bg-primary/5 shadow-md shadow-primary/10 hover:shadow-primary/5"
              : "border-border/80 hover:border-primary/30 hover:shadow-primary/5"
        )
      )}
    >
      {/* Left accent bar — green if worked, otherwise origin-based */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b rounded-l-xl",
        isWorked ? "from-emerald-500/80 to-emerald-500/20" : originAccent[contact.origin]
      )} />

      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative flex gap-3">
        <div className="flex flex-col items-center gap-1.5 pt-0.5">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="h-3.5 w-3.5"
            onClick={(e) => e.stopPropagation()}
          />
          <GripVertical className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {contact.origin === "bca" && <CreditCard className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                <span className="text-sm font-semibold text-foreground truncate">{contact.name}</span>
                <span className="text-sm">{flag}</span>
              </div>
              <div className="text-xs text-foreground/80 truncate">{contact.company}</div>
              <div className="text-[11px] text-muted-foreground">{contact.role}</div>
              {isProcessing && enrichmentState?.scrapingPhase && (
                <div className="text-[10px] font-medium text-[hsl(210,80%,55%)] mt-0.5">
                  {phaseLabel[enrichmentState.scrapingPhase] || "⏳ Elaborazione..."}
                </div>
              )}
              {hasLinkedin && enrichmentState?.linkedinProfile?.headline && (
                <div className="text-[10px] text-muted-foreground/80 mt-0.5 truncate max-w-[180px]" title={enrichmentState.linkedinProfile.headline}>
                  💼 {enrichmentState.linkedinProfile.headline}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span
                className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-md border flex items-center gap-1", oc.bg, oc.text, oc.border)}
                title={contact.originDetail}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", oc.dot)} />
                {oc.label}
              </span>
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", priorityColor(contact.priority))}>
                P{contact.priority}
              </span>
              {/* Worked badge */}
              {isWorked && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md border bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
                  ✓ Fatto
                </span>
              )}
              {hasLinkedin && (
                <span className={cn(
                  "text-[9px] font-semibold px-1.5 py-0.5 rounded-md border flex items-center gap-1",
                  enrichmentState?.linkedinProfile?.connectionStatus === "connected"
                    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                    : enrichmentState?.linkedinProfile?.connectionStatus === "pending"
                    ? "bg-warning/15 text-warning border-warning/30"
                    : "bg-[hsl(210,80%,55%)]/15 text-[hsl(210,80%,55%)] border-[hsl(210,80%,55%)]/30"
                )}>
                  <Linkedin className="w-2.5 h-2.5" />
                  {enrichmentState?.linkedinProfile?.connectionStatus === "connected" ? "✓" : enrichmentState?.linkedinProfile?.connectionStatus === "pending" ? "⏳" : "✓"}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/90 mb-2">
            <span className={cn("truncate max-w-[140px]", oc.text)} title={contact.originDetail}>
              {contact.originDetail}
            </span>
            <span>·</span>
            <span>{contact.language}</span>
            <span>·</span>
            <span>{contact.lastContact}</span>
          </div>

          <div className="flex items-center justify-between">
            {/* Smart channel icons */}
            <SmartChannelIcons contact={contact} />
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="p-1 rounded-md text-muted-foreground/80 hover:text-primary hover:bg-primary/10 transition-colors"
                title="Deep Search"
                onClick={(e) => { e.stopPropagation(); onDeepSearch(); }}
              >
                <Search className="w-3 h-3" />
              </button>
              <button
                className="p-1 rounded-md text-muted-foreground/80 hover:text-chart-3 hover:bg-chart-3/10 transition-colors"
                title="Genera Alias"
                onClick={(e) => { e.stopPropagation(); onAlias(); }}
              >
                <Sparkles className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

import { useState } from "react";
import { useContactDrawer, type RecordSourceType } from "@/contexts/ContactDrawerContext";
import { motion, AnimatePresence } from "framer-motion";
import { GripVertical, Mail, Linkedin, MessageCircle, Smartphone, Search, Sparkles, CreditCard, Briefcase, ChevronDown, ChevronUp, Globe, Check, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ContactEnrichmentCard } from "@/components/contacts/ContactEnrichmentCard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
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
  deepSearchAt?: string;
  enrichmentData?: any;
  memberSince?: string;
  memberYears?: number;
  networks?: string[];
  seniority?: string;
  specialties?: string[];
}

export interface EnrichmentState {
  isActive: boolean;
  scrapingPhase: "idle" | "searching" | "visiting" | "extracting" | "enriching" | "reviewing" | "generating";
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
  sourceType?: RecordSourceType;
  sourceId?: string;
  onToggleSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDeepSearch: () => void;
  onAlias: () => void;
  onLinkedInLookup?: () => void;
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
  bca: { label: "BCA", bg: "bg-primary/15", text: "text-primary", border: "border-primary/30", dot: "bg-primary" },
  manual: { label: "Manuale", bg: "bg-emerald-500/15", text: "text-emerald-500", border: "border-emerald-500/30", dot: "bg-emerald-500" },
};

const originAccent: Record<ContactOrigin, string> = {
  wca: "from-chart-1/60 to-chart-1/10",
  report_aziende: "from-chart-4/60 to-chart-4/10",
  import: "from-chart-3/60 to-chart-3/10",
  bca: "from-primary/60 to-primary/10",
  manual: "from-emerald-500/60 to-emerald-500/10",
};

const phaseLabel: Record<string, string> = {
  searching: "🔎 Ricerca LinkedIn...",
  visiting: "🔍 Visita profilo...",
  extracting: "📋 Estrazione dati...",
  enriching: "🧠 Arricchimento...",
  reviewing: "👁️ In revisione",
  generating: "✨ Generazione messaggio...",
};

function SmartChannelIcons({ contact }: { contact: Contact }) {
  const hasEmail = !!contact.email;
  const hasLinkedin = !!contact.linkedinUrl;
  const hasPhone = !!contact.phone;

  const icons = [
    { key: "Email", Icon: Mail, active: hasEmail, activeClass: "text-primary bg-primary/10", value: contact.email },
    { key: "LinkedIn", Icon: Linkedin, active: hasLinkedin, activeClass: "text-[hsl(210,80%,55%)] bg-[hsl(210,80%,55%)]/10", value: contact.linkedinUrl },
    { key: "WhatsApp", Icon: MessageCircle, active: hasPhone, activeClass: "text-emerald-500 bg-emerald-500/10", value: contact.phone },
    { key: "SMS", Icon: Smartphone, active: hasPhone, activeClass: "text-chart-3 bg-chart-3/10", value: contact.phone },
  ];

  return (
    <div className="flex items-center gap-1">
      {icons.map(({ key, Icon, active, activeClass, value }) => (
        <InfoTooltip key={key} content={active ? `${key}: ${value}` : `${key} non disponibile`}>
          <span className={cn("p-1 rounded-md transition-colors", active ? activeClass : "bg-muted/30 text-muted-foreground/25")}>
            <Icon className="w-3.5 h-3.5" />
          </span>
        </InfoTooltip>
      ))}
    </div>
  );
}

/** Enrichment status micro-badges */
function EnrichmentStatusRow({ contact, hasLiveLinkedin }: { contact: Contact; hasLiveLinkedin: boolean }) {
  const e = contact.enrichmentData;
  const hasLinkedin = hasLiveLinkedin || !!(e?.linkedin_url || e?.linkedin_profile_url || contact.linkedinUrl);
  const hasWebsite = !!(e?.company_website);
  const hasAI = !!contact.deepSearchAt;

  // Extract logo from enrichment data
  const websiteDomain = e?.company_website?.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  return (
    <div className="flex items-center gap-1.5">
      <EnrichBadge icon={<Linkedin className="w-2.5 h-2.5" />} label="LinkedIn" done={hasLinkedin} />
      <EnrichBadge icon={<Globe className="w-2.5 h-2.5" />} label="Sito" done={hasWebsite} />
      <EnrichBadge icon={<Sparkles className="w-2.5 h-2.5" />} label="AI" done={hasAI} />
      {websiteDomain && (
        <InfoTooltip content={`Logo: ${websiteDomain}`}>
          <img
            src={`https://www.google.com/s2/favicons?domain=${websiteDomain}&sz=32`}
            alt="logo"
            className="w-4 h-4 rounded-sm"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </InfoTooltip>
      )}
    </div>
  );
}

function EnrichBadge({ icon, label, done }: { icon: React.ReactNode; label: string; done: boolean }) {
  return (
    <InfoTooltip content={`${label}: ${done ? "completato" : "mancante"}`}>
      <span className={cn(
        "flex items-center gap-0.5 text-[8px] font-medium px-1 py-0.5 rounded border",
        done
          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
          : "bg-muted/30 text-muted-foreground/40 border-border/20"
      )}>
        {icon}
        {done ? <Check className="w-2 h-2" /> : <X className="w-2 h-2" />}
      </span>
    </InfoTooltip>
  );
}

export function CockpitContactCard({ contact, flag, index, isSelected, isWorked, assignment, sourceType, sourceId, onToggleSelect, onDragStart, onDragEnd, onDeepSearch, onAlias, onLinkedInLookup, enrichmentState }: CockpitContactCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { open: openDrawer } = useContactDrawer();
  const oc = originConfig[contact.origin];
  const isProcessing = enrichmentState?.isActive && enrichmentState.scrapingPhase !== "idle";
  const hasLinkedinLive = enrichmentState?.linkedinProfile && (enrichmentState.scrapingPhase === "reviewing" || enrichmentState.scrapingPhase === "generating" || enrichmentState.scrapingPhase === "idle");
  const isAiProcessed = !!contact.deepSearchAt;
  const contactHeadline = contact.enrichmentData?.contact_profile?.linkedin_title;
  const hasEnrichmentData = !!(contact.enrichmentData && (contact.enrichmentData.contact_profile || contact.enrichmentData.company_profile || contact.enrichmentData.linkedin_url || contact.enrichmentData.linkedin_profile_url));
  const hasLiveLinkedin = !!enrichmentState?.linkedinProfile;
  const hasAnyData = hasEnrichmentData || hasLiveLinkedin;

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="checkbox"]') || target.closest('input') || target.closest('a')) return;
    if (e.detail === 2 && sourceType && sourceId) {
      openDrawer({ sourceType, sourceId });
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.3 }}
        draggable={!isProcessing}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        whileHover={isProcessing ? {} : { scale: 1.02, y: -2 }}
        whileTap={isProcessing ? {} : { scale: 0.98 }}
        onClick={handleCardClick}
        className={cn(
          "group relative rounded-xl border bg-card backdrop-blur-xl p-3.5 transition-all duration-300 hover:shadow-lg overflow-hidden",
          isProcessing
            ? "border-muted-foreground/40 bg-muted/[0.03] shadow-sm cursor-default animate-soft-pulse"
            : isWorked
            ? "border-emerald-500/60 bg-emerald-500/5 cursor-grab active:cursor-grabbing"
            : isAiProcessed
            ? "border-primary/30 bg-primary/[0.08] cursor-grab active:cursor-grabbing hover:border-primary/50"
            : "cursor-grab active:cursor-grabbing",
          !isProcessing && !isWorked && !isAiProcessed && (
            contact.origin === "bca"
              ? isSelected
                ? "border-primary/60 bg-primary/5 shadow-md shadow-primary/10"
                : "border-primary/30 hover:border-primary/50"
              : isSelected
                ? "border-primary/60 bg-primary/5 shadow-md shadow-primary/10"
                : "border-border/80 hover:border-primary/30 hover:shadow-primary/5"
          )
        )}
      >
        {/* Left accent bar */}
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b rounded-l-xl",
          isAiProcessed ? "from-primary/80 to-primary/20"
            : isWorked ? "from-emerald-500/80 to-emerald-500/20"
            : originAccent[contact.origin]
        )} />

        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        <div className="relative flex gap-2.5">
          {/* Left: checkbox + drag */}
          <div className="flex flex-col items-center gap-1 pt-0.5">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              className="h-3.5 w-3.5"
              onClick={(e) => e.stopPropagation()}
            />
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
          </div>

          {/* Center content */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* === SECTION 1: Identity === */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {contact.origin === "bca" && <CreditCard className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                  <span className="text-sm font-semibold text-foreground truncate">{contact.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                    className={cn("flex items-center gap-0.5 rounded-md p-0.5 transition-colors", hasAnyData ? "hover:bg-primary/10" : "hover:bg-muted/50")}
                  >
                    {isExpanded ? <ChevronUp className="w-2.5 h-2.5 text-muted-foreground" /> : <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />}
                  </button>
                </div>
                <div className="text-xs text-foreground/80 truncate">{contact.company}</div>
                {contact.role && <div className="text-[11px] text-muted-foreground truncate">{contact.role}</div>}
              </div>

              {/* Right badges: origin + priority + enrichment sparkles */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <div className="flex items-center gap-1">
                  {hasAnyData && (
                    <InfoTooltip content="Enrichment AI completato">
                      <span className="p-0.5 rounded bg-primary/10">
                        <Sparkles className="w-3 h-3 text-primary" />
                      </span>
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

            {/* Meta badges: membership, seniority, networks */}
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

            {/* AI headline preview (collapsed) */}
            {contactHeadline && !isExpanded && (
              <div className="flex items-center gap-1">
                <Briefcase className="w-2.5 h-2.5 text-primary/70 shrink-0" />
                <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{contactHeadline}</span>
              </div>
            )}

            {/* Processing phase */}
            {isProcessing && enrichmentState?.scrapingPhase && (
              <div className="text-[10px] font-medium text-muted-foreground">
                {phaseLabel[enrichmentState.scrapingPhase] || "⏳ Elaborazione..."}
              </div>
            )}

            {/* === SECTION 2: Origin/language/date + channels === */}
            <div className="pt-1.5 border-t border-border/20">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80 mb-1.5">
                <span className={cn("truncate max-w-[100px]", oc.text)}>{contact.originDetail}</span>
                <span>·</span>
                <span>{contact.language}</span>
                <span>·</span>
                <span>{contact.lastContact}</span>
              </div>
              <div className="flex items-center justify-between">
                <SmartChannelIcons contact={contact} />
                {assignment && (
                  <div className="flex items-center gap-1">
                    {(() => {
                      const avatarSrc = resolveAgentAvatar(assignment.agentName, assignment.agentAvatar);
                      return avatarSrc ? (
                        <InfoTooltip content={`Agente: ${assignment.agentName}`}>
                          <img src={avatarSrc} alt={assignment.agentName} className="w-4 h-4 rounded-full ring-1 ring-primary/30" />
                        </InfoTooltip>
                      ) : (
                        <InfoTooltip content={`Agente: ${assignment.agentName}`}>
                          <span className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center text-[8px] font-bold text-primary ring-1 ring-primary/30">
                            {assignment.agentName.charAt(0)}
                          </span>
                        </InfoTooltip>
                      );
                    })()}
                    {assignment.managerName && (
                      <InfoTooltip content={`Manager: ${assignment.managerName}`}>
                        <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                          <Briefcase className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[40px]">{assignment.managerName.split(" ")[0]}</span>
                        </span>
                      </InfoTooltip>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* === SECTION 3: Enrichment status micro-badges === */}
            <div className="pt-1.5 border-t border-border/20">
              <EnrichmentStatusRow contact={contact} hasLiveLinkedin={hasLiveLinkedin} />
            </div>
          </div>
        </div>

        {/* Expandable AI Enrichment Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-border/40 space-y-3">
                {/* Live LinkedIn data */}
                {hasLiveLinkedin && enrichmentState?.linkedinProfile && (
                   <div className="rounded-lg border border-muted-foreground/30 bg-muted/[0.05] p-2.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                      <Linkedin className="w-3 h-3" /> Dati LinkedIn Live
                    </div>
                    {enrichmentState.linkedinProfile.name && (
                      <div className="text-xs text-foreground">{enrichmentState.linkedinProfile.name}</div>
                    )}
                    {enrichmentState.linkedinProfile.headline && (
                      <div className="text-[11px] text-muted-foreground">💼 {enrichmentState.linkedinProfile.headline}</div>
                    )}
                    {enrichmentState.linkedinProfile.location && (
                      <div className="text-[11px] text-muted-foreground">📍 {enrichmentState.linkedinProfile.location}</div>
                    )}
                    {enrichmentState.linkedinProfile.connectionStatus && (
                      <div className="text-[11px] text-muted-foreground">
                        {enrichmentState.linkedinProfile.connectionStatus === "connected" ? "✅ Connesso" : enrichmentState.linkedinProfile.connectionStatus === "pending" ? "⏳ In attesa" : `🔗 ${enrichmentState.linkedinProfile.connectionStatus}`}
                      </div>
                    )}
                  </div>
                )}

                {/* Stored enrichment data */}
                {hasEnrichmentData ? (
                  <ContactEnrichmentCard
                    enrichmentData={contact.enrichmentData}
                    deepSearchAt={contact.deepSearchAt || null}
                  />
                ) : !hasLiveLinkedin ? (
                  <div className="text-center py-3 space-y-2">
                    <p className="text-xs text-muted-foreground">Nessun dato AI disponibile</p>
                    <div className="flex items-center justify-center gap-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={(e) => { e.stopPropagation(); onDeepSearch(); }}>
                        <Search className="w-3 h-3" /> Deep Search
                      </Button>
                      {onLinkedInLookup && (
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={(e) => { e.stopPropagation(); onLinkedInLookup(); }}>
                          <Linkedin className="w-3 h-3" /> LinkedIn Lookup
                        </Button>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </TooltipProvider>
  );
}

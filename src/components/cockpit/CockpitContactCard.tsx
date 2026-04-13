/**
 * CockpitContactCard — shell composing Header, Metrics, and enrichment panel
 */
import { useState } from "react";
import { useContactDrawer, type RecordSourceType } from "@/contexts/ContactDrawerContext";
import { motion, AnimatePresence } from "framer-motion";
import { GripVertical, Search, Linkedin } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ContactEnrichmentCard } from "@/components/contacts/ContactEnrichmentCard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ContactOrigin } from "@/pages/Cockpit";
import { CockpitContactHeader } from "./CockpitContactHeader";
import { CockpitContactMetrics } from "./CockpitContactMetrics";

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
  enrichmentData?: Record<string, unknown>;
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

export function CockpitContactCard({
  contact, flag, index, isSelected, isWorked, assignment, sourceType, sourceId,
  onToggleSelect, onDragStart, onDragEnd, onDeepSearch, onAlias, onLinkedInLookup, enrichmentState,
}: CockpitContactCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { open: openDrawer } = useContactDrawer();
  const isProcessing = enrichmentState?.isActive && enrichmentState.scrapingPhase !== "idle";
  const hasLinkedinLive = !!(enrichmentState?.linkedinProfile && (enrichmentState.scrapingPhase === "reviewing" || enrichmentState.scrapingPhase === "generating" || enrichmentState.scrapingPhase === "idle"));
  const isAiProcessed = !!contact.deepSearchAt;
  const contactHeadline = (contact.enrichmentData?.contact_profile as Record<string, unknown> | undefined)?.linkedin_title as string | undefined;
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
          isProcessing ? "border-muted-foreground/40 bg-muted/[0.03] shadow-sm cursor-default animate-soft-pulse"
            : isWorked ? "border-emerald-500/60 bg-emerald-500/5 cursor-grab active:cursor-grabbing"
            : isAiProcessed ? "border-primary/30 bg-primary/[0.08] cursor-grab active:cursor-grabbing hover:border-primary/50"
            : "cursor-grab active:cursor-grabbing",
          !isProcessing && !isWorked && !isAiProcessed && (
            contact.origin === "bca"
              ? isSelected ? "border-primary/60 bg-primary/5 shadow-md shadow-primary/10" : "border-primary/30 hover:border-primary/50"
              : isSelected ? "border-primary/60 bg-primary/5 shadow-md shadow-primary/10" : "border-border/80 hover:border-primary/30 hover:shadow-primary/5"
          )
        )}
      >
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b rounded-l-xl",
          isAiProcessed ? "from-primary/80 to-primary/20" : isWorked ? "from-emerald-500/80 to-emerald-500/20" : originAccent[contact.origin]
        )} />

        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        <div className="relative flex gap-2.5">
          <div className="flex flex-col items-center gap-1 pt-0.5">
            <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} className="h-3.5 w-3.5" onClick={(e) => e.stopPropagation()} />
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <CockpitContactHeader
              contact={contact}
              isExpanded={isExpanded}
              isWorked={isWorked}
              hasAnyData={hasAnyData}
              onToggleExpand={() => setIsExpanded(!isExpanded)}
              contactHeadline={contactHeadline}
            />

            {isProcessing && enrichmentState?.scrapingPhase && (
              <div className="text-[10px] font-medium text-muted-foreground">
                {phaseLabel[enrichmentState.scrapingPhase] || "⏳ Elaborazione..."}
              </div>
            )}

            <CockpitContactMetrics
              contact={contact}
              assignment={assignment}
              hasLiveLinkedin={hasLiveLinkedin}
              enrichmentState={enrichmentState}
            />
          </div>
        </div>

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
                {hasLinkedinLive && enrichmentState?.linkedinProfile && (
                  <div className="rounded-lg border border-muted-foreground/30 bg-muted/[0.05] p-2.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                      <Linkedin className="w-3 h-3" /> Dati LinkedIn Live
                    </div>
                    {enrichmentState.linkedinProfile.name && <div className="text-xs text-foreground">{enrichmentState.linkedinProfile.name}</div>}
                    {enrichmentState.linkedinProfile.headline && <div className="text-[11px] text-muted-foreground">💼 {enrichmentState.linkedinProfile.headline}</div>}
                    {enrichmentState.linkedinProfile.location && <div className="text-[11px] text-muted-foreground">📍 {enrichmentState.linkedinProfile.location}</div>}
                    {enrichmentState.linkedinProfile.connectionStatus && (
                      <div className="text-[11px] text-muted-foreground">
                        {enrichmentState.linkedinProfile.connectionStatus === "connected" ? "✅ Connesso" : enrichmentState.linkedinProfile.connectionStatus === "pending" ? "⏳ In attesa" : `🔗 ${enrichmentState.linkedinProfile.connectionStatus}`}
                      </div>
                    )}
                  </div>
                )}

                {hasEnrichmentData ? (
                  <ContactEnrichmentCard enrichmentData={contact.enrichmentData} deepSearchAt={contact.deepSearchAt || null} />
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

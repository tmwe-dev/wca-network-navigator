import { lazy, Suspense } from "react";
import { AISearchMonitorButton } from "./AISearchMonitor";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Mail, Linkedin, MessageCircle, Smartphone, Copy, Send, RotateCcw, Target, ExternalLink, Brain, Database, Zap, Globe, User, Building2, BookOpen, Search, CheckCircle2, XCircle, AlertTriangle, UserPlus } from "lucide-react";
import { useMission } from "@/contexts/MissionContext";
import { cn } from "@/lib/utils";
import type { DraftState } from "@/types/cockpit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TypewriterText } from "./TypewriterText";
import { ScrapingPhaseIndicator } from "./ScrapingPhaseIndicator";
import { useAIDraftActions } from "@/hooks/useAIDraftActions";

const LinkedInDMDialog = lazy(() => import("@/components/workspace/LinkedInDMDialog"));

interface AIDraftStudioProps {
  draft: DraftState;
  onDraftChange: (draft: DraftState) => void;
  onRegenerate?: () => void;
  onGenerateAfterReview?: () => void;
}

const channelMeta: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  email: { icon: Mail, label: "Email", color: "text-primary" },
  linkedin: { icon: Linkedin, label: "LinkedIn", color: "text-[hsl(210,80%,55%)]" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", color: "text-success" },
  sms: { icon: Smartphone, label: "SMS", color: "text-chart-3" },
};

export function AIDraftStudio({ draft, onDraftChange, onRegenerate, onGenerateAfterReview }: AIDraftStudioProps) {
  const { goal, baseProposal } = useMission();
  const {
    sending, liDmOpen, setLiDmOpen,
    waBridge, liBridge, pcBridge,
    handleCopy, handleSendWhatsApp, handleSendLinkedIn, handleSend, handleConnectLinkedIn,
  } = useAIDraftActions(draft, onDraftChange);

  const meta = draft.channel ? channelMeta[draft.channel] : null;
  const Icon = meta?.icon || Sparkles;
  const isHtmlContent = draft.channel === "email" && /<(p|br|div|ul|ol)\b/i.test(draft.body);

  if (!draft.channel) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.7, 0.5] }}
          transition={{ repeat: Infinity, duration: 4 }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-chart-3/10 flex items-center justify-center mb-4"
        >
          <Sparkles className="w-7 h-7 text-primary/80" />
        </motion.div>
        <h3 className="text-sm font-medium text-foreground mb-1">AI Draft Studio</h3>
        <p className="text-xs text-muted-foreground max-w-[200px]">
          Trascina un contatto su un canale per generare il messaggio con AI
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={cn("w-4 h-4", meta?.color)} />
          <span className="text-sm font-semibold text-foreground">{meta?.label}</span>
          <span className="text-xs text-muted-foreground">→</span>
          <span className="text-sm text-foreground/90">{draft.contactName}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/90">
          <span>Lingua: {draft.language}</span>
          <span>·</span>
          <span>{draft.companyName}</span>
          {draft.searchLog && draft.searchLog.length > 0 && (
            <AISearchMonitorButton searchLog={draft.searchLog} isSearching={draft.scrapingPhase === "searching"} />
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="preview" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-2 bg-muted/30 p-0.5 h-8">
          <TabsTrigger value="preview" className="text-xs h-7">Preview</TabsTrigger>
          <TabsTrigger value="sources" className="text-xs h-7">Sources</TabsTrigger>
          <TabsTrigger value="variables" className="text-xs h-7">Variables</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="flex-1 overflow-y-auto p-4 space-y-3">
          {draft.scrapingPhase === "reviewing" && draft.linkedinProfile && (
            <ReviewingState draft={draft} onGenerateAfterReview={onGenerateAfterReview} />
          )}
          {draft.scrapingPhase !== "reviewing" && (
            <DraftPreview draft={draft} isHtmlContent={isHtmlContent} />
          )}
        </TabsContent>

        <TabsContent value="sources" className="flex-1 overflow-y-auto p-4">
          <SourcesTab draft={draft} />
        </TabsContent>

        <TabsContent value="variables" className="flex-1 overflow-y-auto p-4">
          <VariablesTab draft={draft} goal={goal} baseProposal={baseProposal} />
        </TabsContent>
      </Tabs>

      {/* Actions footer */}
      <AnimatePresence>
        {draft.body && !draft.isGenerating && draft.scrapingPhase === "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 py-3 border-t border-border/60 flex items-center gap-2"
          >
            <ActionButtons
              draft={draft}
              sending={sending}
              waBridge={waBridge}
              liBridge={liBridge}
              pcBridge={pcBridge}
              onSendEmail={handleSend}
              onSendWhatsApp={handleSendWhatsApp}
              onSendLinkedIn={handleSendLinkedIn}
              onConnectLinkedIn={handleConnectLinkedIn}
              onCopy={handleCopy}
              onDraftChange={onDraftChange}
            />
            <button onClick={handleCopy} className="p-2 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors" title="Copia">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button onClick={onRegenerate} className="p-2 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors" title="Rigenera">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {liDmOpen && (
        <Suspense fallback={null}>
          <LinkedInDMDialog
            open={liDmOpen}
            onOpenChange={setLiDmOpen}
            profileUrl=""
            contactName={draft.contactName}
            companyName={draft.companyName || ""}
            initialMessage={draft.body ? draft.body.replace(/<[^>]*>/g, "").trim() : ""}
          />
        </Suspense>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function ReviewingState({ draft, onGenerateAfterReview }: { draft: DraftState; onGenerateAfterReview?: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="flex items-center gap-2 text-success">
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-sm font-semibold">Profilo analizzato</span>
      </div>
      <div className="bg-[hsl(210,80%,55%)]/5 border border-[hsl(210,80%,55%)]/20 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-[hsl(210,80%,55%)]/20 flex items-center justify-center">
            <Linkedin className="w-5 h-5 text-[hsl(210,80%,55%)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">{draft.linkedinProfile?.name || draft.contactName}</div>
            {draft.linkedinProfile?.headline && <div className="text-xs text-muted-foreground truncate">{draft.linkedinProfile.headline}</div>}
          </div>
        </div>
        {draft.linkedinProfile?.location && <div className="text-xs text-muted-foreground/80">📍 {draft.linkedinProfile.location}</div>}
        {draft.linkedinProfile?.about && (
          <div className="text-xs text-muted-foreground/90 bg-background/50 rounded-lg p-2.5 max-h-[120px] overflow-y-auto leading-relaxed">
            {draft.linkedinProfile.about}
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          {draft.linkedinProfile?.connectionStatus === "connected" ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success"><CheckCircle2 className="w-3 h-3" /> Già connesso</span>
          ) : draft.linkedinProfile?.connectionStatus === "pending" ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/10 text-warning"><AlertTriangle className="w-3 h-3" /> Richiesta in attesa</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground"><UserPlus className="w-3 h-3" /> Non connesso</span>
          )}
        </div>
      </div>
      <button onClick={onGenerateAfterReview} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
        <Sparkles className="w-4 h-4" /> Genera Messaggio AI
      </button>
      <p className="text-[10px] text-muted-foreground text-center">Il messaggio sarà personalizzato in base ai dati estratti dal profilo</p>
    </motion.div>
  );
}

function DraftPreview({ draft, isHtmlContent }: { draft: DraftState; isHtmlContent: boolean }) {
  return (
    <>
      {draft.channel === "email" && (
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground/90 font-semibold">Oggetto</label>
          <div className="mt-1 text-sm font-medium text-foreground">
            {draft.isGenerating && !draft.subject ? <span className="text-muted-foreground/70">Generazione in corso...</span>
              : draft.subject ? <TypewriterText text={draft.subject} speed={25} />
              : <span className="text-muted-foreground/70">In attesa...</span>}
          </div>
        </div>
      )}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground/90 font-semibold">Messaggio</label>
        <div className="mt-2 text-sm text-foreground/90 leading-relaxed">
          {draft.isGenerating && !draft.body ? (
            <div className="space-y-3">
              <ScrapingPhaseIndicator phase={draft.scrapingPhase} linkedinProfile={draft.linkedinProfile} />
              {[1, 2, 3].map(i => (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: [0.3, 0.5, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.3 }} className="h-3 rounded bg-muted/50" style={{ width: `${70 + i * 10}%` }} />
              ))}
            </div>
          ) : draft.body ? (
            isHtmlContent ? <TypewriterText text={draft.body} speed={8} isHtml /> : <TypewriterText text={draft.body} speed={12} />
          ) : <span className="text-muted-foreground/70">In attesa...</span>}
        </div>
      </div>
    </>
  );
}

function SourcesTab({ draft }: { draft: DraftState }) {
  if (!draft._debug) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <Brain className="w-8 h-8 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">Genera un messaggio per vedere le fonti e i log AI</p>
      </div>
    );
  }

  const d = draft._debug;
  return (
    <div className="space-y-3">
      <DebugSection icon={Brain} color="text-primary" label="Modello AI">
        <DebugRow label="Modello" value={<span className="font-mono text-[10px]">{d.model}</span>} />
        <DebugRow label="Qualità" value={d.quality} />
        <DebugRow label="Canale" value={d.channel_instructions} />
      </DebugSection>

      <DebugSection icon={Globe} color="text-chart-3" label="Lingua">
        <DebugRow label="Rilevata" value={d.language_detected} />
        <DebugRow label="Usata" value={d.language_used} />
        <DebugRow label="Paese" value={d.country_code} />
      </DebugSection>

      <DebugSection icon={User} color="text-success" label="Contesto Mittente">
        <DebugRow label="Alias" value={d.sender_alias} />
        <DebugRow label="Azienda" value={d.sender_company} />
        <DebugRow label="Ruolo" value={d.sender_role} />
      </DebugSection>

      <DebugSection icon={Building2} color="text-chart-2" label="Destinatario">
        <DebugRow label="Nome risolto" value={d.recipient_name_resolved} />
      </DebugSection>

      <DebugSection icon={Search} color="text-chart-4" label="Intelligence Destinatario">
        {d.recipient_intelligence ? (
          <>
            {d.recipient_intelligence.warning && (
              <div className="flex items-center gap-1.5 text-warning bg-warning/10 rounded px-2 py-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span className="text-[10px]">{d.recipient_intelligence.warning}</span>
              </div>
            )}
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-medium">Fonti consultate:</span>
              <div className="flex flex-wrap gap-1">
                {d.recipient_intelligence.sources_checked.map(src => {
                  const found = d.recipient_intelligence!.data_found[src === "partner_contacts" ? "contacts" : src === "partner_networks" ? "networks" : src === "partner_services" ? "services" : src];
                  return (
                    <span key={src} className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-mono ${found ? "bg-success/10 text-success" : "bg-muted/50 text-muted-foreground"}`}>
                      {found ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                      {src.replace("partner_", "").replace("imported_", "")}
                    </span>
                  );
                })}
              </div>
            </div>
            {d.recipient_intelligence.enrichment_snippet && (
              <details className="group">
                <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">Mostra contesto iniettato nel prompt ▸</summary>
                <pre className="mt-1 text-[9px] text-muted-foreground/90 whitespace-pre-wrap bg-background/50 rounded p-2 max-h-[150px] overflow-y-auto">{d.recipient_intelligence.enrichment_snippet}</pre>
              </details>
            )}
          </>
        ) : <span className="text-xs text-muted-foreground">Non disponibile</span>}
      </DebugSection>

      <DebugSection icon={Database} color="text-chart-2" label="Fonti Arricchimento">
        <DebugRow label="Interazioni trovate" value={d.interaction_history_count ?? "N/A"} />
        <DebugRow label="Sito aziendale" value={<SourceBadge source={d.website_source} />} />
        <DebugRow label="LinkedIn" value={<SourceBadge source={d.linkedin_source} />} />
        {draft.linkedinProfile && (
          <div className="bg-[hsl(210,80%,55%)]/5 border border-[hsl(210,80%,55%)]/20 rounded-lg p-2.5 space-y-1 mt-1">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[hsl(210,80%,55%)] uppercase tracking-wider">
              <Linkedin className="w-3 h-3" /> Profilo LinkedIn (Scraping Live)
            </div>
            {draft.linkedinProfile.name && <div className="text-xs font-medium text-foreground">{draft.linkedinProfile.name}</div>}
            {draft.linkedinProfile.headline && <div className="text-[11px] text-muted-foreground">{draft.linkedinProfile.headline}</div>}
            {draft.linkedinProfile.about && <div className="text-[10px] text-muted-foreground/80 line-clamp-3">{draft.linkedinProfile.about}</div>}
            {draft.linkedinProfile.location && <div className="text-[10px] text-muted-foreground/60">📍 {draft.linkedinProfile.location}</div>}
          </div>
        )}
      </DebugSection>

      <DebugSection icon={BookOpen} color="text-warning" label="Knowledge Base">
        <DebugRow label="KB caricata" value={<span className={d.kb_loaded ? "text-success" : "text-destructive"}>{d.kb_loaded ? "✓ Sì" : "✗ No"}</span>} />
        <DebugRow label="Sales KB" value={<span className={d.sales_kb_loaded ? "text-success" : "text-destructive"}>{d.sales_kb_loaded ? "✓ Sì" : "✗ No"}</span>} />
        {d.sales_kb_loaded && <DebugRow label="Sezioni" value={d.sales_kb_sections} />}
      </DebugSection>

      <DebugSection icon={Target} color="text-primary" label="Obiettivo & Proposta">
        <div><span className="text-muted-foreground">Goal:</span> <span className="text-foreground">{d.goal_used}</span></div>
        <div><span className="text-muted-foreground">Proposta:</span> <span className="text-foreground">{d.proposal_used}</span></div>
      </DebugSection>

      <DebugSection icon={Zap} color="text-warning" label="Consumo">
        <DebugRow label="Token input" value={<span className="font-mono">{d.tokens_input.toLocaleString()}</span>} />
        <DebugRow label="Token output" value={<span className="font-mono">{d.tokens_output.toLocaleString()}</span>} />
        <DebugRow label="Crediti usati" value={<span className="font-semibold">{d.credits_consumed}</span>} />
      </DebugSection>

      <DebugSection icon={Database} color="text-muted-foreground" label="Impostazioni caricate">
        <div className="flex flex-wrap gap-1">
          {d.settings_keys_found.map(key => (
            <span key={key} className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground font-mono">{key.replace("ai_", "")}</span>
          ))}
        </div>
      </DebugSection>
    </div>
  );
}

function VariablesTab({ draft, goal, baseProposal }: { draft: DraftState; goal: string; baseProposal: string }) {
  return (
    <div className="space-y-3">
      <DebugSection icon={Target} color="text-primary" label="Contesto AI (da sidebar)">
        <DebugRow label="Goal" value={<span className="truncate max-w-[180px]">{goal || "—"}</span>} />
        <DebugRow label="Proposta" value={<span className="truncate max-w-[180px]">{baseProposal ? baseProposal.slice(0, 40) + "…" : "—"}</span>} />
      </DebugSection>
      <div className="border-t border-border/30 pt-2 space-y-2 text-xs">
        <DebugRow label="recipient_name" value={draft.contactName} />
        <DebugRow label="company" value={draft.companyName} />
        <DebugRow label="channel" value={draft.channel} />
        <DebugRow label="language" value={draft.language} />
        <DebugRow label="country" value={draft.countryCode} />
        {draft.contactEmail && <DebugRow label="email" value={draft.contactEmail} />}
        {draft.contactPhone && <DebugRow label="phone" value={draft.contactPhone} />}
      </div>
    </div>
  );
}

function ActionButtons({ draft, sending, waBridge, liBridge, _pcBridge, onSendEmail, onSendWhatsApp, onSendLinkedIn, onConnectLinkedIn, onCopy, _onDraftChange }: Record<string, any>) {
  if (draft.channel === "email" && draft.contactEmail) {
    return (
      <button onClick={onSendEmail} disabled={sending} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
        <Send className="w-3.5 h-3.5" /> {sending ? "Invio..." : "Invia Email"}
      </button>
    );
  }
  if (draft.channel === "whatsapp" && draft.contactPhone) {
    return (
      <button onClick={onSendWhatsApp} disabled={sending} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[hsl(142,70%,40%)] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
        {waBridge.isAvailable ? <Send className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
        {sending ? "Invio..." : waBridge.isAvailable ? "Invia WhatsApp" : "Apri WhatsApp"}
      </button>
    );
  }
  if (draft.channel === "linkedin") {
    return (
      <div className="flex-1 flex gap-1.5">
        <button onClick={onSendLinkedIn} disabled={sending} className={cn("flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-medium transition-opacity disabled:opacity-50", draft.linkedinProfile?.connectionStatus === "connected" ? "bg-[hsl(210,80%,45%)] hover:opacity-90" : "bg-[hsl(210,80%,45%)]/60 hover:opacity-90")}>
          {liBridge.isAvailable ? <Send className="w-3.5 h-3.5" /> : <Linkedin className="w-3.5 h-3.5" />}
          {sending ? "..." : "DM"}
        </button>
        {draft.linkedinProfile?.connectionStatus !== "connected" && draft.linkedinProfile?.connectionStatus !== "pending" && (
          <button onClick={onConnectLinkedIn} disabled={sending || !liBridge.isAvailable} className={cn("flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-medium transition-opacity disabled:opacity-50", liBridge.isAvailable ? "bg-[hsl(210,80%,35%)] hover:opacity-90" : "bg-[hsl(210,80%,35%)]/50 opacity-60 cursor-not-allowed")} title="Invia richiesta di collegamento">
            <UserPlus className="w-3.5 h-3.5" /> {sending ? "..." : "Connetti"}
          </button>
        )}
        {draft.linkedinProfile?.connectionStatus === "pending" && (
          <span className="flex items-center gap-1 px-3 py-2 rounded-lg bg-warning/10 text-warning text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5" /> In attesa
          </span>
        )}
      </div>
    );
  }
  return (
    <button onClick={onCopy} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
      <Copy className="w-3.5 h-3.5" /> Copia messaggio
    </button>
  );
}

/* ── Tiny helpers ── */

function DebugSection({ icon: Icon, color, label, children }: { icon: React.ElementType; color: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("w-3 h-3", color)} />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="bg-muted/30 rounded-lg p-2.5 space-y-1 text-xs">{children}</div>
    </div>
  );
}

function DebugRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function SourceBadge({ source }: { source?: string }) {
  return (
    <span className={`font-mono text-[10px] ${source === "live_scraped" ? "text-success" : source === "cached" ? "text-chart-3" : "text-muted-foreground"}`}>
      {source === "live_scraped" ? "🔴 Live" : source === "cached" ? "📦 Cache" : "—"}
    </span>
  );
}

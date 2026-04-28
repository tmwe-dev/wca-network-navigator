import { useState, useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PageErrorBoundary } from "@/components/ui/PageErrorBoundary";
import { ROUTE_OUTREACH, ROUTE_NETWORK, ROUTE_CRM, ROUTE_SETTINGS, ROUTE_EMAIL_COMPOSER } from "@/constants/routes";
import {
  Target, FileText, Link2, MessageSquareText, Paperclip,
  Search, Globe, Sparkles, ArrowUpFromLine, Settings, Database,
  Rocket, ExternalLink, Zap, Users, Check,
} from "lucide-react";
import { useMission } from "@/contexts/MissionContext";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import ActiveMissionsPanel from "@/components/missions/ActiveMissionsPanel";
import { DrawerPresetManager } from "./drawer/DrawerPresetManager";
import { DrawerGoalEditor } from "./drawer/DrawerGoalEditor";
import { DrawerDocumentsPanel } from "./drawer/DrawerDocumentsPanel";
import { RecipientsSection } from "./drawer/RecipientsSection";

interface MissionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MissionDrawer({ open, onOpenChange }: MissionDrawerProps) {
  const m = useMission();
  const location = useLocation();
  const seg = location.pathname.replace(/^\/v2/, "");
  const [drawerWidth, setDrawerWidth] = useState<number | null>(null);
  const isResizing = useRef(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [contextDialogOpen, setContextDialogOpen] = useState(false);
  const [docsDialogOpen, setDocsDialogOpen] = useState(false);
  const [linksDialogOpen, setLinksDialogOpen] = useState(false);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const onMove = (ev: MouseEvent) => { if (!isResizing.current) return; setDrawerWidth(Math.max(320, Math.min(window.innerWidth - ev.clientX, window.innerWidth * 0.8))); };
    const onUp = () => { isResizing.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const isOutreach = seg === `/${ROUTE_OUTREACH}`;
  const isNetwork = seg === `/${ROUTE_NETWORK}`;
  const isExploreMap = location.pathname.startsWith("/v2/explore/map");
  const isExploreSherlock = location.pathname.startsWith("/v2/explore/deep-search");
  const isExplore = location.pathname.startsWith("/v2/explore");
  const isCRM = seg === `/${ROUTE_CRM}`;
  const isSettings = seg === `/${ROUTE_SETTINGS}`;
  const isEmailComposer = seg === `/${ROUTE_EMAIL_COMPOSER}`;
  const showRecipients = isOutreach || isEmailComposer || isNetwork || isCRM;
  const contextTitle = isOutreach ? "Outreach Control" : isNetwork ? "Network Actions" : isCRM ? "CRM Actions" : isSettings ? "Strumenti" : isExploreMap ? "Mappa Globale" : isExploreSherlock ? "Sherlock Investigator" : isExplore ? "Esplora" : "Mission Control";
  const contextSubtitle = isOutreach ? "Email, destinatari e invio" : isNetwork ? "Deep Search e arricchimento" : isCRM ? "Contatti e comunicazione" : isSettings ? "Azioni rapide" : isExploreMap ? "Naviga countries e partner sul globo" : isExploreSherlock ? "Indagini multi-livello su company / contact" : isExplore ? "Discovery, mappa e investigazione" : "Configura e vai";

  return (
    <PageErrorBoundary>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={cn("p-0 flex flex-col border-l border-primary/10 bg-background/95 backdrop-blur-xl", !drawerWidth && "w-[90vw] sm:w-[520px] md:w-[600px] lg:w-[680px] sm:max-w-[700px]")} style={drawerWidth ? { width: drawerWidth, maxWidth: "80vw" } : undefined}>
        {/* Header */}
        <div className="px-5 py-3 border-b border-border/50 bg-gradient-to-r from-primary/[0.04] to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-inner shadow-primary/10">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-foreground">{contextTitle}</h3>
              <p className="text-xs text-muted-foreground leading-tight">
                {contextSubtitle}. Configura goal, allega documenti e seleziona destinatari per la missione.
              </p>
            </div>
            <span className="ml-auto text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium shrink-0">
              {isOutreach ? "Outreach" : isNetwork ? "Network" : isCRM ? "CRM" : isSettings ? "Settings" : isExplore ? "Esplora" : "Globale"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {isNetwork && <ContextActionPanel title="Azioni Network" icon={Globe} color="text-muted-foreground" actions={[
            { label: "Sync WCA", icon: Database, event: "sync-wca-trigger" },
            { label: "Deep Search", icon: Search, event: "deep-search-country" },
            { label: "Alias batch", icon: Sparkles, event: "generate-aliases" },
            { label: "Export", icon: ArrowUpFromLine, event: "export-partners" },
          ]} />}
          {isExploreMap && <ContextActionPanel title="Azioni Mappa" icon={Globe} color="text-primary" actions={[
            { label: "Sync WCA", icon: Database, event: "sync-wca-trigger" },
            { label: "Deep Search Country", icon: Search, event: "deep-search-country" },
            { label: "Vai a Sherlock", icon: Sparkles, event: "explore-open-sherlock" },
          ]} />}
          {isExploreSherlock && <ContextActionPanel title="Sherlock" icon={Search} color="text-primary" actions={[
            { label: "Nuova indagine", icon: Sparkles, event: "sherlock-new" },
            { label: "Storico", icon: FileText, event: "sherlock-history" },
          ]} />}
          {isCRM && <ContextActionPanel title="Azioni CRM" icon={Users} color="text-emerald-500" actions={[
            { label: "Deep Search", icon: Search, event: "crm-deep-search" },
            { label: "LinkedIn", icon: ExternalLink, event: "crm-linkedin-lookup" },
            { label: "→ Cockpit", icon: Rocket, event: "crm-send-cockpit" },
            { label: "Export", icon: ArrowUpFromLine, event: "crm-export" },
          ]} />}
          {isSettings && <ContextActionPanel title="Strumenti" icon={Settings} color="text-primary" actions={[
            { label: "Avvia batch", icon: Zap, event: "enrichment-batch-start" },
            { label: "Export", icon: ArrowUpFromLine, event: "enrichment-export" },
          ]} />}

          {(isOutreach || (!isNetwork && !isCRM && !isSettings)) && (
            <>
              <DrawerPresetManager presets={m.presets} activePresetId={m.activePresetId} quality={m.quality} onLoadPreset={m.loadPreset} onSavePreset={m.savePreset} onDeletePreset={m.deletePreset} onSetQuality={m.setQuality} />
              <div className="flex items-center gap-2">
                <ActionIcon icon={Target} label="Obiettivo" tooltip="Cosa vuoi ottenere con questa missione (es. fissare meeting, presentare il servizio)" active={!!m.goal} activeName={m.goal ? (m.goal.length > 18 ? m.goal.slice(0, 18) + "…" : m.goal) : undefined} color="from-primary/25 to-primary/5" iconColor="text-primary" onClick={() => setGoalDialogOpen(true)} />
                <ActionIcon icon={FileText} label="Proposta" tooltip="Il messaggio base / value proposition che l'AI userà come scheletro per le email" active={!!m.baseProposal} activeName={m.baseProposal ? (m.baseProposal.length > 18 ? m.baseProposal.slice(0, 18) + "…" : m.baseProposal) : undefined} color="from-muted-foreground/25 to-muted-foreground/5" iconColor="text-muted-foreground" onClick={() => setProposalDialogOpen(true)} />
              </div>
              <div className="flex items-center gap-2">
                <ActionIcon icon={MessageSquareText} label="Contesto" tooltip="Da dove arriva il lead (fiera, referral, online…) — guida tono e apertura" active={!!m.context} activeName={m.context ? (m.context.length > 18 ? m.context.slice(0, 18) + "…" : m.context) : undefined} color="from-primary/25 to-primary/5" iconColor="text-primary" onClick={() => setContextDialogOpen(true)} />
                <ActionIcon icon={Paperclip} label="Docs" tooltip="Allegati che l'AI può citare o inviare (PDF, presentazioni, listini)" active={m.documents.length > 0} count={m.documents.length} color="from-primary/25 to-primary/5" iconColor="text-primary" onClick={() => setDocsDialogOpen(true)} />
                <ActionIcon icon={Link2} label="Link" tooltip="URL di riferimento (sito, case study, calendario booking)" active={m.referenceLinks.length > 0} count={m.referenceLinks.length} color="from-emerald-500/25 to-emerald-500/5" iconColor="text-emerald-500" onClick={() => setLinksDialogOpen(true)} />
              </div>
            </>
          )}

          <ActiveMissionsPanel />
          {showRecipients && <RecipientsSection search={recipientSearch} setSearch={setRecipientSearch} />}
        </div>

        <DrawerGoalEditor goalOpen={goalDialogOpen} proposalOpen={proposalDialogOpen} contextOpen={contextDialogOpen} onGoalOpenChange={setGoalDialogOpen} onProposalOpenChange={setProposalDialogOpen} onContextOpenChange={setContextDialogOpen} goal={m.goal} baseProposal={m.baseProposal} context={m.context} onSetGoal={m.setGoal} onSetBaseProposal={m.setBaseProposal} onSetContext={m.setContext} />
        <DrawerDocumentsPanel documents={m.documents} referenceLinks={m.referenceLinks} uploading={m.uploading} docsOpen={docsDialogOpen} linksOpen={linksDialogOpen} onDocsOpenChange={setDocsDialogOpen} onLinksOpenChange={setLinksDialogOpen} onUpload={m.upload} onRemoveDocument={m.removeDocument} onSetReferenceLinks={m.setReferenceLinks} />

        <div onMouseDown={startResize} className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-50" />
      </SheetContent>
    </Sheet>
    </PageErrorBoundary>
  );
}

/* ── Inline helpers (small, not worth separate files) ── */

function ContextActionPanel({ title, icon: Icon, color, actions }: {
  title: string; icon: React.ElementType; color: string;
  actions: Array<{ label: string; icon: React.ElementType; event: string }>;
}) {
  return (
    <div className="p-3 rounded-xl border border-border/30 bg-muted/10 space-y-1.5">
      <div className="flex items-center gap-2"><Icon className={cn("w-4 h-4", color)} /><span className="text-xs font-bold text-foreground">{title}</span></div>
      <div className="grid grid-cols-2 gap-1.5">
        {actions.map(a => (
          <Button key={a.event} variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
            window.dispatchEvent(new CustomEvent(a.event));
            import("sonner").then(s => s.toast.info(`${a.label} avviato`));
          }}>
            <a.icon className="w-3.5 h-3.5" /> {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ActionIcon({ icon: Icon, label, tooltip, active, activeName, count, color, iconColor, onClick }: {
  icon: React.ElementType; label: string; tooltip?: string; active: boolean; activeName?: string; count?: number;
  color: string; iconColor: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} title={tooltip} className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border transition-all flex-1 min-w-0", active ? "border-primary/20 bg-primary/5 shadow-sm" : "border-border/30 bg-muted/10 hover:border-primary/20 hover:bg-primary/5")}>
      <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0 shadow-inner", color)}><Icon className={cn("w-4 h-4", iconColor)} /></div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
        {activeName && <p className="text-xs font-medium text-foreground truncate">{activeName}</p>}
        {count !== undefined && count > 0 && <p className="text-xs font-medium text-foreground">{count}</p>}
        {!active && !activeName && (count === undefined || count === 0) && <p className="text-[10px] text-muted-foreground/60">Non impostato</p>}
      </div>
      {active && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
    </button>
  );
}

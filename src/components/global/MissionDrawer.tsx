import { useState, useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Target, FileText, Link2, Plus, X, Upload, Save, Trash2,
  Search, Building2, Mail, Users, Paperclip, Zap, Bookmark,
  Check, ExternalLink, Globe, Sparkles, ArrowUpFromLine,
  Settings, Database, Rocket, MessageSquareText,
} from "lucide-react";
import { useMission } from "@/contexts/MissionContext";
import { cn } from "@/lib/utils";
import QualitySelector from "@/components/workspace/QualitySelector";
import ContentSelect from "@/components/shared/ContentSelect";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

interface MissionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MissionDrawer({ open, onOpenChange }: MissionDrawerProps) {
  const m = useMission();
  const fileRef = useRef<HTMLInputElement>(null);
  const [recipientSearch, setRecipientSearch] = useState("");
  const location = useLocation();
  const currentPath = location.pathname;
  const [drawerWidth, setDrawerWidth] = useState<number | null>(null);
  const isResizing = useRef(false);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const w = Math.max(320, Math.min(window.innerWidth - ev.clientX, window.innerWidth * 0.8));
      setDrawerWidth(w);
    };
    const onUp = () => {
      isResizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [contextDialogOpen, setContextDialogOpen] = useState(false);
  const [docsDialogOpen, setDocsDialogOpen] = useState(false);
  const [linksDialogOpen, setLinksDialogOpen] = useState(false);
  const [newLink, setNewLink] = useState("");

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    m.savePreset(presetName.trim(), m.activePresetId || undefined);
    setPresetName("");
    setPresetDialogOpen(false);
  };

  const addLink = () => {
    const url = newLink.trim();
    if (!url) return;
    m.setReferenceLinks(prev => [...prev, url]);
    setNewLink("");
  };

  const isOutreach = currentPath === "/outreach";
  const isNetwork = currentPath === "/network";
  const isCRM = currentPath === "/crm";
  const isSettings = currentPath === "/settings";
  const isEmailComposer = currentPath === "/email-composer";

  // Destinatari visible only in outreach-related contexts
  const showRecipients = isOutreach || isEmailComposer || isNetwork || isCRM;

  const contextTitle = isOutreach ? "Outreach Control" : isNetwork ? "Network Actions" : isCRM ? "CRM Actions" : isSettings ? "Strumenti" : "Mission Control";
  const contextSubtitle = isOutreach ? "Email, destinatari e invio" : isNetwork ? "Deep Search e arricchimento" : isCRM ? "Contatti e comunicazione" : isSettings ? "Azioni rapide" : "Configura e vai";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={cn("p-0 flex flex-col border-l border-primary/10 bg-background/95 backdrop-blur-xl", !drawerWidth && "w-[90vw] sm:w-[520px] md:w-[600px] lg:w-[680px] sm:max-w-[700px]")} style={drawerWidth ? { width: drawerWidth, maxWidth: "80vw" } : undefined}>
        {/* Header */}
        <div className="px-5 py-3 border-b border-border/50 bg-gradient-to-r from-primary/[0.04] to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-inner shadow-primary/10">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">{contextTitle}</h3>
              <p className="text-[11px] text-muted-foreground">{contextSubtitle}</p>
            </div>
            <span className="ml-auto text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {isOutreach ? "Outreach" : isNetwork ? "Network" : isCRM ? "CRM" : isSettings ? "Settings" : "Globale"}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">

          {/* Network actions */}
          {isNetwork && (
            <ContextSection title="Azioni Network" icon={Globe} color="text-blue-500">
              <p className="text-xs text-muted-foreground mb-2">Seleziona paesi per attivare azioni.</p>
              <div className="grid grid-cols-2 gap-1.5">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
                  window.dispatchEvent(new CustomEvent("sync-wca-trigger"));
                  import("sonner").then(m => m.toast.info("Sync WCA avviato"));
                }}>
                  <Database className="w-3.5 h-3.5" /> Sync WCA
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
                  window.dispatchEvent(new CustomEvent("deep-search-country"));
                  import("sonner").then(m => m.toast.info("Deep Search avviato"));
                }}>
                  <Search className="w-3.5 h-3.5" /> Deep Search
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
                  window.dispatchEvent(new CustomEvent("generate-aliases"));
                  import("sonner").then(m => m.toast.info("Generazione alias avviata"));
                }}>
                  <Sparkles className="w-3.5 h-3.5" /> Alias batch
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
                  window.dispatchEvent(new CustomEvent("export-partners"));
                  import("sonner").then(m => m.toast.info("Export avviato"));
                }}>
                  <ArrowUpFromLine className="w-3.5 h-3.5" /> Export
                </Button>
              </div>
            </ContextSection>
          )}

          {/* CRM actions */}
          {isCRM && (
            <ContextSection title="Azioni CRM" icon={Users} color="text-emerald-500">
              <p className="text-xs text-muted-foreground mb-2">Azioni rapide per contatti selezionati.</p>
              <div className="grid grid-cols-2 gap-1.5">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
                  window.dispatchEvent(new CustomEvent("crm-deep-search"));
                  import("sonner").then(m => m.toast.info("Deep Search contatti avviato"));
                }}>
                  <Search className="w-3.5 h-3.5" /> Deep Search
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
                  window.dispatchEvent(new CustomEvent("crm-linkedin-lookup"));
                  import("sonner").then(m => m.toast.info("LinkedIn lookup avviato"));
                }}>
                  <ExternalLink className="w-3.5 h-3.5" /> LinkedIn
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
                  window.dispatchEvent(new CustomEvent("crm-send-cockpit"));
                  import("sonner").then(m => m.toast.info("Inviato al Cockpit"));
                }}>
                  <Rocket className="w-3.5 h-3.5" /> → Cockpit
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
                  window.dispatchEvent(new CustomEvent("crm-export"));
                  import("sonner").then(m => m.toast.info("Export contatti avviato"));
                }}>
                  <ArrowUpFromLine className="w-3.5 h-3.5" /> Export
                </Button>
              </div>
            </ContextSection>
          )}

          {/* Settings actions */}
          {isSettings && (
            <ContextSection title="Strumenti" icon={Settings} color="text-amber-500">
              <p className="text-xs text-muted-foreground mb-2">Azioni batch disponibili.</p>
              <div className="grid grid-cols-2 gap-1.5">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => window.dispatchEvent(new CustomEvent("enrichment-batch-start"))}>
                  <Zap className="w-3.5 h-3.5" /> Avvia batch
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => window.dispatchEvent(new CustomEvent("enrichment-export"))}>
                  <ArrowUpFromLine className="w-3.5 h-3.5" /> Export
                </Button>
              </div>
            </ContextSection>
          )}

          {/* Mission Config (Outreach or global) */}
          {(isOutreach || (!isNetwork && !isCRM && !isSettings)) && (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {m.presets.length <= 5 ? (
                    <>
                      {m.presets.map(p => (
                        <button
                          key={p.id}
                          onClick={() => m.loadPreset(p)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                            m.activePresetId === p.id
                              ? "border-primary bg-primary/10 text-primary shadow-sm"
                              : "border-border/40 bg-muted/20 text-foreground hover:border-primary/30 hover:bg-primary/5"
                          )}
                        >
                          <Bookmark className="w-3 h-3 inline mr-1" />
                          {p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name}
                        </button>
                      ))}
                    </>
                  ) : (
                    <Select value={m.activePresetId || ""} onValueChange={v => { const p = m.presets.find(x => x.id === v); if (p) m.loadPreset(p); }}>
                      <SelectTrigger className="h-8 text-xs w-[160px]">
                        <SelectValue placeholder="Preset..." />
                      </SelectTrigger>
                      <SelectContent>
                        {m.presets.map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <button onClick={() => setPresetDialogOpen(true)} className="w-8 h-8 rounded-lg border border-dashed border-border/50 flex items-center justify-center hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  {m.activePresetId && (
                    <button onClick={() => m.deletePreset(m.activePresetId!)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  )}
                  <div className="ml-auto">
                    <QualitySelector value={m.quality} onChange={m.setQuality} size="sm" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ActionIcon icon={Target} label="Obiettivo" active={!!m.goal} activeName={m.goal ? (m.goal.length > 18 ? m.goal.slice(0, 18) + "…" : m.goal) : undefined} color="from-primary/25 to-primary/5" iconColor="text-primary" onClick={() => setGoalDialogOpen(true)} />
                <ActionIcon icon={FileText} label="Proposta" active={!!m.baseProposal} activeName={m.baseProposal ? (m.baseProposal.length > 18 ? m.baseProposal.slice(0, 18) + "…" : m.baseProposal) : undefined} color="from-blue-500/25 to-blue-500/5" iconColor="text-blue-500" onClick={() => setProposalDialogOpen(true)} />
              </div>
              <div className="flex items-center gap-2">
                <ActionIcon icon={MessageSquareText} label="Contesto" active={!!m.context} activeName={m.context ? (m.context.length > 18 ? m.context.slice(0, 18) + "…" : m.context) : undefined} color="from-violet-500/25 to-violet-500/5" iconColor="text-violet-500" onClick={() => setContextDialogOpen(true)} />
                <ActionIcon icon={Paperclip} label="Docs" active={m.documents.length > 0} count={m.documents.length} color="from-amber-500/25 to-amber-500/5" iconColor="text-amber-500" onClick={() => setDocsDialogOpen(true)} />
                <ActionIcon icon={Link2} label="Link" active={m.referenceLinks.length > 0} count={m.referenceLinks.length} color="from-emerald-500/25 to-emerald-500/5" iconColor="text-emerald-500" onClick={() => setLinksDialogOpen(true)} />
              </div>
            </>
          )}

          {/* Recipients — only in outreach/email contexts */}
          {showRecipients && <RecipientsSection search={recipientSearch} setSearch={setRecipientSearch} />}
        </div>

        {/* Dialogs */}
        <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2"><Bookmark className="w-4 h-4 text-amber-500" /> Salva Preset</DialogTitle>
              <DialogDescription className="text-xs">Salva la configurazione attuale</DialogDescription>
            </DialogHeader>
            <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Nome preset..." className="h-9 text-sm" onKeyDown={e => e.key === "Enter" && handleSavePreset()} />
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setPresetDialogOpen(false)}>Annulla</Button>
              <Button size="sm" onClick={handleSavePreset} disabled={!presetName.trim()}>Salva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Obiettivo</DialogTitle>
              <DialogDescription className="text-xs">Seleziona o scrivi il tuo obiettivo</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-3 py-2">
              <ContentSelect type="goals" onSelect={(text) => m.setGoal(text)} selectedText={m.goal} placeholder="Seleziona obiettivo..." />
              <Textarea value={m.goal} onChange={e => m.setGoal(e.target.value)} placeholder="Descrivi l'obiettivo..." className="min-h-[100px] text-sm resize-none" />
            </div>
            <DialogFooter><Button size="sm" onClick={() => setGoalDialogOpen(false)}>Chiudi</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={proposalDialogOpen} onOpenChange={setProposalDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500" /> Proposta Base</DialogTitle>
              <DialogDescription className="text-xs">Seleziona o scrivi la proposta</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-3 py-2">
              <ContentSelect type="proposals" onSelect={(text) => m.setBaseProposal(text)} selectedText={m.baseProposal} placeholder="Seleziona proposta..." />
              <Textarea value={m.baseProposal} onChange={e => m.setBaseProposal(e.target.value)} placeholder="La proposta commerciale..." className="min-h-[100px] text-sm resize-none" />
            </div>
            <DialogFooter><Button size="sm" onClick={() => setProposalDialogOpen(false)}>Chiudi</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={contextDialogOpen} onOpenChange={setContextDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2"><MessageSquareText className="w-4 h-4 text-violet-500" /> Contesto</DialogTitle>
              <DialogDescription className="text-xs">Perché stai scrivendo? Il contesto guida l'AI nella personalizzazione</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-3 py-2">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Fiera / Evento", value: "Incontrato a una fiera/evento di settore" },
                  { label: "Trovato online", value: "Trovato online attraverso ricerca di mercato" },
                  { label: "Referral", value: "Segnalato da un partner/contatto comune" },
                  { label: "Ex-cliente", value: "Ricontatto di un ex-cliente per nuova collaborazione" },
                  { label: "Cold outreach", value: "Primo contatto a freddo basato sul profilo aziendale" },
                  { label: "Follow-up", value: "Follow-up dopo un primo contatto precedente" },
                ].map(chip => (
                  <button
                    key={chip.label}
                    onClick={() => m.setContext(m.context ? `${m.context}. ${chip.value}` : chip.value)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-border/40 bg-muted/20 hover:border-violet-500/40 hover:bg-violet-500/5 transition-colors"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <Textarea value={m.context} onChange={e => m.setContext(e.target.value)} placeholder="Es: Abbiamo incontrato il sig. Rossi alla fiera di Milano il 15 marzo. La sua azienda opera nel settore logistico e cerca partner per spedizioni aeree..." className="min-h-[120px] text-sm resize-none" />
            </div>
            <DialogFooter>
              {m.context && <Button variant="ghost" size="sm" onClick={() => m.setContext("")}>Cancella</Button>}
              <Button size="sm" onClick={() => setContextDialogOpen(false)}>Chiudi</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2"><Paperclip className="w-4 h-4 text-amber-500" /> Documenti ({m.documents.length})</DialogTitle>
              <DialogDescription className="text-xs">Gestisci i documenti allegati</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {m.documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/20 group">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">{doc.file_name}</span>
                  <button onClick={() => m.removeDocument(doc.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded">
                    <X className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              ))}
              {m.documents.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nessun documento</p>}
            </div>
            <input ref={fileRef} type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) m.upload(e.target.files[0]); }} />
            <Button variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()} disabled={m.uploading}>
              <Upload className="w-4 h-4" /> {m.uploading ? "Caricamento..." : "Carica documento"}
            </Button>
          </DialogContent>
        </Dialog>

        <Dialog open={linksDialogOpen} onOpenChange={setLinksDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2"><Link2 className="w-4 h-4 text-emerald-500" /> Link ({m.referenceLinks.length})</DialogTitle>
              <DialogDescription className="text-xs">Gestisci i link di riferimento</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {m.referenceLinks.map((url, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/20 group">
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs truncate flex-1">{url}</span>
                  <button onClick={() => m.setReferenceLinks(prev => prev.filter((_, j) => j !== i))} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded">
                    <X className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              ))}
              {m.referenceLinks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nessun link</p>}
            </div>
            <div className="flex gap-2">
              <Input value={newLink} onChange={e => setNewLink(e.target.value)} placeholder="https://..." className="h-9 text-sm flex-1" onKeyDown={e => e.key === "Enter" && addLink()} />
              <Button size="sm" variant="outline" onClick={addLink} className="h-9 px-3"><Plus className="w-4 h-4" /></Button>
            </div>
          </DialogContent>
        </Dialog>
        {/* Resize handle */}
        <div
          onMouseDown={startResize}
          className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-50"
        />
      </SheetContent>
    </Sheet>
  );
}

/* ── Context Section ── */
function ContextSection({ title, icon: Icon, color, children }: {
  title: string; icon: any; color: string; children: React.ReactNode;
}) {
  return (
    <div className="p-3 rounded-xl border border-border/30 bg-muted/10 space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon className={cn("w-4 h-4", color)} />
        <span className="text-xs font-bold text-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

/* ── Action Icon Button ── */
function ActionIcon({ icon: Icon, label, active, activeName, count, color, iconColor, onClick }: {
  icon: any; label: string; active: boolean; activeName?: string; count?: number;
  color: string; iconColor: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all flex-1 min-w-0",
        active
          ? "border-primary/20 bg-primary/5 shadow-sm"
          : "border-border/30 bg-muted/10 hover:border-primary/20 hover:bg-primary/5"
      )}
    >
      <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0 shadow-inner", color)}>
        <Icon className={cn("w-4 h-4", iconColor)} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
        {activeName && <p className="text-xs font-medium text-foreground truncate">{activeName}</p>}
        {count !== undefined && count > 0 && <p className="text-xs font-medium text-foreground">{count}</p>}
        {!active && !activeName && (count === undefined || count === 0) && (
          <p className="text-[10px] text-muted-foreground/60">Non impostato</p>
        )}
      </div>
      {active && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
    </button>
  );
}

/* ── Recipients Section ── */
function RecipientsSection({ search, setSearch }: { search: string; setSearch: (s: string) => void }) {
  const m = useMission();

  const { data: searchResults = [] } = useQuery({
    queryKey: ["mission-recipient-search", search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const q = `%${search}%`;
      const { data, error } = await supabase
        .from("partners")
        .select("id, company_name, country_name, city, email, enriched_at")
        .or(`company_name.ilike.${q},city.ilike.${q},country_name.ilike.${q}`)
        .order("company_name")
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: search.length >= 2,
  });

  const handleAdd = (p: any) => {
    m.addRecipient({
      partnerId: p.id, companyName: p.company_name,
      email: p.email, city: p.city, countryName: p.country_name,
      countryCode: p.country_code || undefined,
      isEnriched: !!p.enriched_at,
    });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/25 to-emerald-500/5 flex items-center justify-center">
          <Users className="w-4 h-4 text-emerald-500" />
        </div>
        <span className="text-sm font-bold text-foreground">Destinatari</span>
        {m.recipients.length > 0 && (
          <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">{m.recipients.length}</span>
        )}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca azienda..." className="h-9 text-xs pl-9 border-border/40 bg-muted/10" />
      </div>
      {search.length >= 2 && searchResults.length > 0 && (
        <div className="max-h-[160px] overflow-y-auto space-y-0.5 rounded-lg border border-border/20 p-1">
          {searchResults.map((p: any) => (
            <button key={p.id} onClick={() => handleAdd(p)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-primary/5 transition-colors text-left">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{p.company_name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{p.city}, {p.country_name}</p>
              </div>
              {p.email && <Mail className="w-3 h-3 text-emerald-500 shrink-0" />}
              <Plus className="w-3 h-3 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
      {m.recipients.length > 0 && (
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {m.recipients.map((r, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/15 border border-border/15 group">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{r.companyName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{r.city}, {r.countryName}</p>
              </div>
              {r.email && <Mail className="w-3 h-3 text-emerald-500 shrink-0" />}
              {r.isEnriched && <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />}
              <button onClick={() => m.removeRecipient(i)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 rounded">
                <X className="w-3 h-3 text-destructive" />
              </button>
            </div>
          ))}
          <button onClick={m.clearRecipients} className="w-full text-center text-[10px] text-destructive hover:underline py-1">Rimuovi tutti</button>
        </div>
      )}
    </div>
  );
}

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
  Check, ExternalLink,
} from "lucide-react";
import { useMission } from "@/contexts/MissionContext";
import { cn } from "@/lib/utils";
import QualitySelector from "@/components/workspace/QualitySelector";
import ContentSelect from "@/components/shared/ContentSelect";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MissionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MissionDrawer({ open, onOpenChange }: MissionDrawerProps) {
  const m = useMission();
  const fileRef = useRef<HTMLInputElement>(null);
  const [recipientSearch, setRecipientSearch] = useState("");

  // Popup states
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[90vw] sm:w-[520px] md:w-[600px] lg:w-[680px] sm:max-w-[700px] p-0 flex flex-col border-l border-primary/10 bg-background/95 backdrop-blur-xl">
        {/* ── HEADER ── */}
        <div className="px-5 py-3 border-b border-border/50 bg-gradient-to-r from-primary/[0.04] to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-inner shadow-primary/10">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Mission Control</h3>
              <p className="text-[11px] text-muted-foreground">Configura e vai</p>
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">

          {/* ROW 1: Presets + Quality */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Preset buttons (≤5) or dropdown (>5) */}
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

              {/* Add preset */}
              <button
                onClick={() => setPresetDialogOpen(true)}
                className="w-8 h-8 rounded-lg border border-dashed border-border/50 flex items-center justify-center hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
              </button>

              {/* Delete active preset */}
              {m.activePresetId && (
                <button
                  onClick={() => m.deletePreset(m.activePresetId!)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              )}

              {/* Quality toggle — pushed right */}
              <div className="ml-auto">
                <QualitySelector value={m.quality} onChange={m.setQuality} size="sm" />
              </div>
            </div>
          </div>

          {/* ROW 2: Action icons — Goal, Proposta, Docs, Links */}
          <div className="flex items-center gap-2">
            {/* Goal */}
            <ActionIcon
              icon={Target}
              label="Obiettivo"
              active={!!m.goal}
              activeName={m.goal ? (m.goal.length > 18 ? m.goal.slice(0, 18) + "…" : m.goal) : undefined}
              color="from-primary/25 to-primary/5"
              iconColor="text-primary"
              onClick={() => setGoalDialogOpen(true)}
            />

            {/* Proposta */}
            <ActionIcon
              icon={FileText}
              label="Proposta"
              active={!!m.baseProposal}
              activeName={m.baseProposal ? (m.baseProposal.length > 18 ? m.baseProposal.slice(0, 18) + "…" : m.baseProposal) : undefined}
              color="from-blue-500/25 to-blue-500/5"
              iconColor="text-blue-500"
              onClick={() => setProposalDialogOpen(true)}
            />

            {/* Docs */}
            <ActionIcon
              icon={Paperclip}
              label="Docs"
              active={m.documents.length > 0}
              count={m.documents.length}
              color="from-amber-500/25 to-amber-500/5"
              iconColor="text-amber-500"
              onClick={() => setDocsDialogOpen(true)}
            />

            {/* Links */}
            <ActionIcon
              icon={Link2}
              label="Link"
              active={m.referenceLinks.length > 0}
              count={m.referenceLinks.length}
              color="from-emerald-500/25 to-emerald-500/5"
              iconColor="text-emerald-500"
              onClick={() => setLinksDialogOpen(true)}
            />
          </div>

          {/* ROW 3: Recipients */}
          <RecipientsSection search={recipientSearch} setSearch={setRecipientSearch} />
        </div>

        {/* ── DIALOGS ── */}

        {/* Save Preset Dialog */}
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

        {/* Goal Dialog */}
        <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Obiettivo</DialogTitle>
              <DialogDescription className="text-xs">Seleziona o scrivi il tuo obiettivo</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-3 py-2">
              <ContentSelect type="goals" onSelect={(text) => { m.setGoal(text); }} selectedText={m.goal} placeholder="Seleziona obiettivo..." />
              <Textarea value={m.goal} onChange={e => m.setGoal(e.target.value)} placeholder="Descrivi l'obiettivo..." className="min-h-[100px] text-sm resize-none" />
            </div>
            <DialogFooter>
              <Button size="sm" onClick={() => setGoalDialogOpen(false)}>Chiudi</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Proposal Dialog */}
        <Dialog open={proposalDialogOpen} onOpenChange={setProposalDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500" /> Proposta Base</DialogTitle>
              <DialogDescription className="text-xs">Seleziona o scrivi la proposta</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-3 py-2">
              <ContentSelect type="proposals" onSelect={(text) => { m.setBaseProposal(text); }} selectedText={m.baseProposal} placeholder="Seleziona proposta..." />
              <Textarea value={m.baseProposal} onChange={e => m.setBaseProposal(e.target.value)} placeholder="La proposta commerciale..." className="min-h-[100px] text-sm resize-none" />
            </div>
            <DialogFooter>
              <Button size="sm" onClick={() => setProposalDialogOpen(false)}>Chiudi</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Docs Dialog */}
        <Dialog open={docsDialogOpen} onOpenChange={setDocsDialogOpen}>
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

        {/* Links Dialog */}
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

      </SheetContent>
    </Sheet>
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
            <button key={p.id} onClick={() => handleAdd(p)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-muted/50 transition-colors">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{p.company_name}</p>
                <p className="text-[9px] text-muted-foreground truncate">{p.city}, {p.country_name}</p>
              </div>
              {p.email && <Mail className="w-3 h-3 text-emerald-500 shrink-0" />}
              <Plus className="w-3 h-3 text-primary shrink-0" />
            </button>
          ))}
        </div>
      )}

      {m.recipients.length > 0 && (
        <div className="space-y-0.5">
          {m.recipients.map((r, idx) => (
            <div key={idx} className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/20 border border-border/20 group">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{r.companyName}</p>
              </div>
              {r.email ? <Mail className="w-3 h-3 text-emerald-500 shrink-0" /> : <span className="text-[8px] text-destructive">no email</span>}
              <button onClick={() => m.removeRecipient(idx)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 rounded">
                <X className="w-3 h-3 text-destructive" />
              </button>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="w-full h-6 text-[10px] text-muted-foreground" onClick={m.clearRecipients}>
            Rimuovi tutti
          </Button>
        </div>
      )}

      {m.recipients.length === 0 && search.length < 2 && (
        <p className="text-[10px] text-muted-foreground text-center py-2">Cerca e aggiungi destinatari</p>
      )}
    </div>
  );
}

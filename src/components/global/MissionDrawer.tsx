import { useState, useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Target, FileText, Link2, Plus, X, Upload, Save, Trash2,
  Search, Building2, Mail, Users, Paperclip, Zap, Bookmark,
  ChevronDown,
} from "lucide-react";
import { useMission } from "@/contexts/MissionContext";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  const [newLink, setNewLink] = useState("");
  const [presetName, setPresetName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [docsOpen, setDocsOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);

  const addLink = () => {
    const url = newLink.trim();
    if (!url) return;
    m.setReferenceLinks(prev => [...prev, url]);
    setNewLink("");
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    m.savePreset(presetName.trim(), m.activePresetId || undefined);
    setPresetName("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[440px] p-0 flex flex-col border-l border-primary/10 bg-background/95 backdrop-blur-xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/50 bg-gradient-to-r from-primary/[0.04] to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Mission Context</h3>
              <p className="text-xs text-muted-foreground">Configura obiettivo e materiali per AI</p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* ── PRESET ── */}
          <div className="bg-muted/20 rounded-xl p-4 space-y-3 border border-border/30">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4.5 h-4.5 text-amber-500" />
              <span className="text-sm font-bold text-foreground">Preset Rapido</span>
            </div>
            {m.presets.length > 0 && (
              <Select value={m.activePresetId || ""} onValueChange={v => { const p = m.presets.find(x => x.id === v); if (p) m.loadPreset(p); }}>
                <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Carica un preset salvato..." /></SelectTrigger>
                <SelectContent>
                  {m.presets.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-sm">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Nome preset..." className="h-10 text-sm flex-1" />
              <Button variant="outline" className="h-10 gap-1.5 text-sm px-3" onClick={handleSavePreset}>
                <Save className="w-4 h-4" /> Salva
              </Button>
            </div>
            {m.activePresetId && (
              <Button variant="ghost" className="h-9 text-sm text-destructive gap-1.5 w-full" onClick={() => m.deletePreset(m.activePresetId!)}>
                <Trash2 className="w-4 h-4" /> Elimina preset attivo
              </Button>
            )}
          </div>

          {/* ── QUALITÀ AI ── */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4.5 h-4.5 text-yellow-500" />
              <span className="text-sm font-bold text-foreground">Qualità AI</span>
            </div>
            <p className="text-xs text-muted-foreground">Livello di generazione per email e outreach</p>
            <QualitySelector value={m.quality} onChange={m.setQuality} size="md" />
          </div>

          <hr className="border-border/30" />

          {/* ── OBIETTIVO ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <span className="text-sm font-bold text-foreground">Obiettivo</span>
            </div>
            <ContentSelect
              type="goals"
              onSelect={(text) => m.setGoal(text)}
              selectedText={m.goal}
              placeholder="Seleziona obiettivo dalla libreria..."
            />
            <Textarea
              value={m.goal} onChange={e => m.setGoal(e.target.value)}
              placeholder="Descrivi l'obiettivo delle comunicazioni..."
              className="min-h-[100px] text-sm bg-muted/20 border-border/40 resize-none focus:border-primary/50"
            />
          </div>

          {/* ── PROPOSTA ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-bold text-foreground">Proposta Base</span>
            </div>
            <ContentSelect
              type="proposals"
              onSelect={(text) => m.setBaseProposal(text)}
              selectedText={m.baseProposal}
              placeholder="Seleziona proposta dalla libreria..."
            />
            <Textarea
              value={m.baseProposal} onChange={e => m.setBaseProposal(e.target.value)}
              placeholder="La proposta commerciale di base..."
              className="min-h-[120px] text-sm bg-muted/20 border-border/40 resize-none focus:border-primary/50"
            />
          </div>

          {/* ── DESTINATARI ── */}
          <RecipientsSection search={recipientSearch} setSearch={setRecipientSearch} />

          {/* ── DOCUMENTI (collapsible) ── */}
          <Collapsible open={docsOpen} onOpenChange={setDocsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 group">
              <Paperclip className="w-4.5 h-4.5 text-muted-foreground" />
              <span className="text-sm font-bold text-foreground flex-1 text-left">Documenti</span>
              {m.documents.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{m.documents.length}</span>
              )}
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", docsOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {m.documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/30 group">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">{doc.file_name}</span>
                  <span className="text-xs text-muted-foreground">{(doc.file_size / 1024).toFixed(0)}KB</span>
                  <button onClick={() => m.removeDocument(doc.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded">
                    <X className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              ))}
              <input ref={fileRef} type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) m.upload(e.target.files[0]); }} />
              <Button variant="outline" className="w-full h-10 text-sm gap-2 border-dashed" onClick={() => fileRef.current?.click()} disabled={m.uploading}>
                <Upload className="w-4 h-4" /> {m.uploading ? "Caricamento..." : "Carica documento"}
              </Button>
            </CollapsibleContent>
          </Collapsible>

          {/* ── LINK (collapsible) ── */}
          <Collapsible open={linksOpen} onOpenChange={setLinksOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 group">
              <Link2 className="w-4.5 h-4.5 text-muted-foreground" />
              <span className="text-sm font-bold text-foreground flex-1 text-left">Link di Riferimento</span>
              {m.referenceLinks.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{m.referenceLinks.length}</span>
              )}
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", linksOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {m.referenceLinks.map((url, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/30 group">
                  <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">{url}</span>
                  <button onClick={() => m.setReferenceLinks(prev => prev.filter((_, j) => j !== i))} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded">
                    <X className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={newLink} onChange={e => setNewLink(e.target.value)} placeholder="https://..." className="h-10 text-sm flex-1" onKeyDown={e => e.key === "Enter" && addLink()} />
                <Button variant="outline" className="h-10 w-10 p-0" onClick={addLink}><Plus className="w-4 h-4" /></Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </SheetContent>
    </Sheet>
  );
}

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
      partnerId: p.id,
      companyName: p.company_name,
      email: p.email,
      city: p.city,
      countryName: p.country_name,
      isEnriched: !!p.enriched_at,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-emerald-500" />
        <span className="text-sm font-bold text-foreground">Destinatari</span>
        {m.recipients.length > 0 && (
          <span className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-medium">{m.recipients.length}</span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca azienda da aggiungere..."
          className="h-10 text-sm pl-10 border-border/50 bg-muted/20"
        />
      </div>

      {/* Results */}
      {search.length >= 2 && searchResults.length > 0 && (
        <div className="max-h-[180px] overflow-y-auto space-y-1 rounded-lg border border-border/30 p-1.5">
          {searchResults.map((p: any) => (
            <button
              key={p.id}
              onClick={() => handleAdd(p)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-muted/50 transition-colors"
            >
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.company_name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.city}, {p.country_name}</p>
              </div>
              {p.email && <Mail className="w-4 h-4 text-emerald-500 shrink-0" />}
              <Plus className="w-4 h-4 text-primary shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Selected */}
      {m.recipients.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">{m.recipients.length} selezionati</p>
          {m.recipients.map((r, idx) => (
            <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/20 border border-border/30 group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.companyName}</p>
                {r.contactName && <p className="text-xs text-muted-foreground truncate">{r.contactName}</p>}
              </div>
              {r.email ? <Mail className="w-4 h-4 text-emerald-500 shrink-0" /> : <span className="text-xs text-destructive">no email</span>}
              <button onClick={() => m.removeRecipient(idx)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded">
                <X className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          ))}
          <Button variant="ghost" className="w-full h-8 text-xs text-muted-foreground" onClick={m.clearRecipients}>
            Rimuovi tutti
          </Button>
        </div>
      )}

      {m.recipients.length === 0 && search.length < 2 && (
        <p className="text-xs text-muted-foreground text-center py-3">Cerca e aggiungi destinatari per le comunicazioni</p>
      )}
    </div>
  );
}

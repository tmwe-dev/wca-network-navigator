import { useState, useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, ChevronDown, FileText, Link2, Plus, X, Upload, Save, Trash2 } from "lucide-react";
import { useMission } from "@/contexts/MissionContext";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import QualitySelector from "@/components/workspace/QualitySelector";
import { useMission } from "@/contexts/MissionContext";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface MissionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MissionDrawer({ open, onOpenChange }: MissionDrawerProps) {
  const m = useMission();
  const [newLink, setNewLink] = useState("");
  const [presetName, setPresetName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [openSections, setOpenSections] = useState({
    goal: true, proposal: true, documents: false, links: false,
  });

  const toggle = (key: keyof typeof openSections) =>
    setOpenSections(p => ({ ...p, [key]: !p[key] }));

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
      <SheetContent side="right" className="w-[360px] sm:max-w-[400px] p-0 flex flex-col border-l border-primary/10 bg-background/95 backdrop-blur-xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/50 bg-gradient-to-r from-primary/[0.04] to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Mission Context</h3>
              <p className="text-[11px] text-muted-foreground">Configura obiettivo e materiali per AI</p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Goal */}
          <Section title="Obiettivo" icon="🎯" open={openSections.goal} onToggle={() => toggle("goal")}>
            <Textarea
              value={m.goal} onChange={e => m.setGoal(e.target.value)}
              placeholder="Descrivi l'obiettivo delle comunicazioni..."
              className="min-h-[80px] text-sm bg-muted/30 border-border/40 resize-none focus:border-primary/50"
            />
          </Section>

          {/* Proposal */}
          <Section title="Proposta Base" icon="📝" open={openSections.proposal} onToggle={() => toggle("proposal")}>
            <Textarea
              value={m.baseProposal} onChange={e => m.setBaseProposal(e.target.value)}
              placeholder="La proposta commerciale di base..."
              className="min-h-[100px] text-sm bg-muted/30 border-border/40 resize-none focus:border-primary/50"
            />
          </Section>

          {/* Documents */}
          <Section title="Documenti" icon="📎" open={openSections.documents} onToggle={() => toggle("documents")} badge={m.documents.length || undefined}>
            <div className="space-y-2">
              {m.documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30 group">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground truncate flex-1">{doc.file_name}</span>
                  <span className="text-[10px] text-muted-foreground">{(doc.file_size / 1024).toFixed(0)}KB</span>
                  <button onClick={() => m.removeDocument(doc.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/10 rounded">
                    <X className="w-3 h-3 text-destructive" />
                  </button>
                </div>
              ))}
              <input ref={fileRef} type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) m.upload(e.target.files[0]); }} />
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5 border-dashed" onClick={() => fileRef.current?.click()} disabled={m.uploading}>
                <Upload className="w-3.5 h-3.5" /> {m.uploading ? "Caricamento..." : "Carica documento"}
              </Button>
            </div>
          </Section>

          {/* Links */}
          <Section title="Link di Riferimento" icon="🔗" open={openSections.links} onToggle={() => toggle("links")} badge={m.referenceLinks.length || undefined}>
            <div className="space-y-2">
              {m.referenceLinks.map((url, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30 group">
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground truncate flex-1">{url}</span>
                  <button onClick={() => m.setReferenceLinks(prev => prev.filter((_, j) => j !== i))} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/10 rounded">
                    <X className="w-3 h-3 text-destructive" />
                  </button>
                </div>
              ))}
              <div className="flex gap-1.5">
                <Input value={newLink} onChange={e => setNewLink(e.target.value)} placeholder="https://..." className="h-8 text-xs flex-1" onKeyDown={e => e.key === "Enter" && addLink()} />
                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={addLink}><Plus className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </Section>

          {/* Presets */}
          <div className="pt-2 border-t border-border/30 space-y-2">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Preset</p>
            {m.presets.length > 0 && (
              <Select value={m.activePresetId || ""} onValueChange={v => { const p = m.presets.find(x => x.id === v); if (p) m.loadPreset(p); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Carica preset..." /></SelectTrigger>
                <SelectContent>
                  {m.presets.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-1.5">
              <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Nome preset..." className="h-8 text-xs flex-1" />
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={handleSavePreset}><Save className="w-3 h-3" /> Salva</Button>
            </div>
            {m.activePresetId && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive gap-1 w-full" onClick={() => m.deletePreset(m.activePresetId!)}>
                <Trash2 className="w-3 h-3" /> Elimina preset attivo
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, icon, open, onToggle, badge, children }: {
  title: string; icon: string; open: boolean; onToggle: () => void; badge?: number; children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors group">
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-medium text-foreground flex-1 text-left">{title}</span>
        {badge && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-mono">{badge}</span>}
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-2 pt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

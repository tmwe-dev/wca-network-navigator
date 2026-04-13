import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bookmark, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import QualitySelector, { type EmailQuality } from "@/components/workspace/QualitySelector";
import type { WorkspacePreset } from "@/hooks/useWorkspacePresets";

interface Props {
  presets: WorkspacePreset[];
  activePresetId: string | null;
  quality: EmailQuality;
  onLoadPreset: (p: WorkspacePreset) => void;
  onSavePreset: (name: string, id?: string) => void;
  onDeletePreset: (id: string) => void;
  onSetQuality: (q: EmailQuality) => void;
}

export function DrawerPresetManager({ presets, activePresetId, quality, onLoadPreset, onSavePreset, onDeletePreset, onSetQuality }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  const handleSave = () => {
    if (!presetName.trim()) return;
    onSavePreset(presetName.trim(), activePresetId || undefined);
    setPresetName("");
    setDialogOpen(false);
  };

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {presets.length <= 5 ? (
            presets.map(p => (
              <button key={p.id} onClick={() => onLoadPreset(p)} className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                activePresetId === p.id
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border/40 bg-muted/20 text-foreground hover:border-primary/30 hover:bg-primary/5"
              )}>
                <Bookmark className="w-3 h-3 inline mr-1" />
                {p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name}
              </button>
            ))
          ) : (
            <Select value={activePresetId || ""} onValueChange={v => { const p = presets.find(x => x.id === v); if (p) onLoadPreset(p); }}>
              <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue placeholder="Preset..." /></SelectTrigger>
              <SelectContent>
                {presets.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <button onClick={() => setDialogOpen(true)} className="w-8 h-8 rounded-lg border border-dashed border-border/50 flex items-center justify-center hover:border-primary/40 hover:bg-primary/5 transition-colors">
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          {activePresetId && (
            <button onClick={() => onDeletePreset(activePresetId)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </button>
          )}
          <div className="ml-auto">
            <QualitySelector value={quality} onChange={onSetQuality} size="sm" />
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><Bookmark className="w-4 h-4 text-primary" /> Salva Preset</DialogTitle>
            <DialogDescription className="text-xs">Salva la configurazione attuale</DialogDescription>
          </DialogHeader>
          <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Nome preset..." className="h-9 text-sm" onKeyDown={e => e.key === "Enter" && handleSave()} />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button size="sm" onClick={handleSave} disabled={!presetName.trim()}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Check, Handshake, RefreshCw, Search, Briefcase, Globe,
  FileText, Target, Pencil,
} from "lucide-react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import {
  CONTENT_CATEGORIES, DEFAULT_GOALS, DEFAULT_PROPOSALS, type ContentItem,
} from "@/data/defaultContentPresets";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { createLogger } from "@/lib/log";

const log = createLogger("ContentSelect");

const ICON_MAP: Record<string, any> = {
  Handshake, RefreshCw, Search, Briefcase, Globe, FileText, Target,
};
const CYCLE_ICONS = [Target, Handshake, Briefcase, Search, Globe, RefreshCw, FileText];

interface ContentSelectProps {
  type: "goals" | "proposals";
  onSelect: (text: string) => void;
  selectedText?: string;
  placeholder?: string;
}

export default function ContentSelect({ type, onSelect, selectedText, placeholder }: ContentSelectProps) {
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const [pickOpen, setPickOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("primo_contatto");

  const settingsKey = type === "goals" ? "custom_goals" : "custom_proposals";
  const defaults = type === "goals" ? DEFAULT_GOALS : DEFAULT_PROPOSALS;
  const typeLabel = type === "goals" ? "Obiettivo" : "Proposta";

  const items = useMemo<ContentItem[]>(() => {
    try {
      return settings?.[settingsKey] ? JSON.parse(settings[settingsKey]) : defaults;
    } catch (e) { log.debug("fallback used after parse failure", { error: e instanceof Error ? e.message : String(e) }); return defaults; }
  }, [settings?.[settingsKey]]);

  const grouped = useMemo(() => {
    const map: Record<string, ContentItem[]> = {};
    items.forEach((item) => {
      const cat = item.category || "altro";
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    });
    return map;
  }, [items]);

  const selectedName = items.find(i => i.text === selectedText)?.name;

  const handlePick = (item: ContentItem) => {
    onSelect(item.text);
    setPickOpen(false);
  };

  const handleCreate = () => {
    if (!newName.trim() || !newText.trim()) return;
    const newItem: ContentItem = { name: newName.trim(), text: newText.trim(), category: newCategory };
    const updated = [...items, newItem];
    updateSetting.mutate(
      { key: settingsKey, value: JSON.stringify(updated) },
      {
        onSuccess: () => {
          toast({ title: "Creato con successo" });
          onSelect(newItem.text);
          setCreateOpen(false);
          setPickOpen(false);
          setNewName("");
          setNewText("");
        },
      },
    );
  };

  const getCatMeta = (key: string) => {
    const cat = CONTENT_CATEGORIES.find(c => c.key === key);
    if (!cat) return { label: key, Icon: FileText };
    return { label: cat.label, Icon: ICON_MAP[cat.icon] || FileText };
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setPickOpen(true)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all hover:border-primary/40 hover:bg-primary/5",
          selectedName
            ? "border-primary/20 bg-primary/5"
            : "border-border/50 bg-muted/20"
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
          <Target className="w-4 h-4 text-primary" />
        </div>
        <span className={cn("text-sm flex-1 truncate", selectedName ? "font-medium text-foreground" : "text-muted-foreground")}>
          {selectedName || placeholder || `Seleziona ${typeLabel.toLowerCase()}...`}
        </span>
        {selectedName && <Check className="w-4 h-4 text-primary shrink-0" />}
      </button>

      {/* Picker Dialog */}
      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Seleziona {typeLabel}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Scegli dalla libreria o crea un nuovo contenuto
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2 space-y-5">
            {Object.entries(grouped).map(([catKey, catItems]) => {
              const { label: catLabel, Icon: CatIcon } = getCatMeta(catKey);
              return (
                <div key={catKey}>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <CatIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{catLabel}</span>
                    <span className="text-[10px] bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded-full">{catItems.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {catItems.map((item, idx) => {
                      const globalIdx = items.indexOf(item);
                      const ItemIcon = CYCLE_ICONS[globalIdx % CYCLE_ICONS.length];
                      const isSelected = item.text === selectedText;
                      return (
                        <button
                          key={globalIdx}
                          onClick={() => handlePick(item)}
                          className={cn(
                            "relative flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all hover:shadow-md hover:border-primary/40",
                            isSelected
                              ? "border-primary/50 bg-primary/10 shadow-sm shadow-primary/10"
                              : "border-border/40 bg-card hover:bg-muted/30"
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                            "bg-gradient-to-br shadow-inner",
                            isSelected
                              ? "from-primary/30 to-primary/10 shadow-primary/10"
                              : "from-muted/60 to-muted/20 shadow-muted/20"
                          )}>
                            <ItemIcon className={cn("w-5 h-5", isSelected ? "text-primary" : "text-muted-foreground")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-medium leading-tight", isSelected && "text-primary")}>
                              {item.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                              {item.text.slice(0, 100)}…
                            </p>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border/30 pt-3 flex justify-between">
            <Button variant="outline" className="gap-2" onClick={() => { setPickOpen(false); setCreateOpen(true); }}>
              <Plus className="w-4 h-4" /> Crea nuovo {typeLabel.toLowerCase()}
            </Button>
            <Button variant="ghost" onClick={() => setPickOpen(false)}>Chiudi</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Nuovo {typeLabel}</DialogTitle>
            <DialogDescription className="text-sm">Aggiungi alla libreria</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Es: Follow-up dopo fiera..." className="h-10 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Categoria</label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTENT_CATEGORIES.map(c => (
                    <SelectItem key={c.key} value={c.key} className="text-sm">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Testo</label>
              <Textarea value={newText} onChange={e => setNewText(e.target.value)} placeholder="Scrivi il contenuto..." className="min-h-[140px] text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Annulla</Button>
            <Button onClick={handleCreate} disabled={updateSetting.isPending || !newName.trim() || !newText.trim()}>Crea e Seleziona</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

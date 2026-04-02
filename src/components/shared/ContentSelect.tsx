import { useState, useMemo } from "react";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import {
  CONTENT_CATEGORIES, DEFAULT_GOALS, DEFAULT_PROPOSALS, type ContentItem,
} from "@/data/defaultContentPresets";
import { toast } from "@/hooks/use-toast";

interface ContentSelectProps {
  type: "goals" | "proposals";
  onSelect: (text: string) => void;
  selectedText?: string;
  placeholder?: string;
}

export default function ContentSelect({ type, onSelect, selectedText, placeholder }: ContentSelectProps) {
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("primo_contatto");

  const settingsKey = type === "goals" ? "custom_goals" : "custom_proposals";
  const defaults = type === "goals" ? DEFAULT_GOALS : DEFAULT_PROPOSALS;

  const items = useMemo<ContentItem[]>(() => {
    try {
      return settings?.[settingsKey] ? JSON.parse(settings[settingsKey]) : defaults;
    } catch { return defaults; }
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

  const handleValueChange = (val: string) => {
    if (val === "__create_new__") {
      setCreateOpen(true);
      return;
    }
    const item = items.find(i => i.name === val);
    if (item) onSelect(item.text);
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
          setNewName("");
          setNewText("");
        },
      },
    );
  };

  const getCatLabel = (key: string) =>
    CONTENT_CATEGORIES.find(c => c.key === key)?.label || key;

  return (
    <>
      <Select value={selectedName || ""} onValueChange={handleValueChange}>
        <SelectTrigger className="h-10 text-sm bg-muted/30 border-border/50">
          <SelectValue placeholder={placeholder || "Seleziona dalla libreria..."} />
        </SelectTrigger>
        <SelectContent className="max-h-[350px]">
          {Object.entries(grouped).map(([catKey, catItems]) => (
            <SelectGroup key={catKey}>
              <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {getCatLabel(catKey)}
              </SelectLabel>
              {catItems.map((item, idx) => (
                <SelectItem key={`${catKey}-${idx}`} value={item.name} className="text-sm py-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground line-clamp-1">{item.text.slice(0, 80)}…</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
          <SelectSeparator />
          <SelectItem value="__create_new__" className="text-sm py-2 text-primary font-medium">
            <span className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Crea nuovo...
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              {type === "goals" ? "Nuovo Obiettivo" : "Nuova Proposta"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Crea un nuovo contenuto da aggiungere alla libreria
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
              <Input
                value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Es: Follow-up dopo fiera..."
                className="h-10 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Categoria</label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_CATEGORIES.map(c => (
                    <SelectItem key={c.key} value={c.key} className="text-sm">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Testo</label>
              <Textarea
                value={newText} onChange={e => setNewText(e.target.value)}
                placeholder="Scrivi il contenuto completo..."
                className="min-h-[140px] text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Annulla</Button>
            <Button onClick={handleCreate} disabled={updateSetting.isPending || !newName.trim() || !newText.trim()}>
              Crea e Seleziona
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

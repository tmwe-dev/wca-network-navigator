import { useState, useMemo } from "react";
import {
  Target, Handshake, RefreshCw, Search, Briefcase, Globe, FileText,
  Pencil, Check, Plus,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import {
  CONTENT_CATEGORIES, DEFAULT_GOALS, DEFAULT_PROPOSALS, type ContentItem,
} from "@/data/defaultContentPresets";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { createLogger } from "@/lib/log";

const log = createLogger("ContentPicker");

const ICON_MAP: Record<string, any> = {
  Handshake, RefreshCw, Search, Briefcase, Globe, FileText, Target,
};

const CYCLE_ICONS = [Target, Handshake, Briefcase, Search, Globe, RefreshCw, FileText];

interface ContentPickerProps {
  type: "goals" | "proposals";
  onSelect: (text: string) => void;
  selectedText?: string;
  triggerLabel?: string;
  className?: string;
}

export default function ContentPicker({
  type, onSelect, selectedText, triggerLabel, className,
}: ContentPickerProps) {
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ item: ContentItem; index: number } | null>(null);
  const [editName, setEditName] = useState("");
  const [editText, setEditText] = useState("");

  const settingsKey = type === "goals" ? "custom_goals" : "custom_proposals";
  const defaults = type === "goals" ? DEFAULT_GOALS : DEFAULT_PROPOSALS;
  const label = type === "goals" ? "Goal" : "Proposta";

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

  const getCategoryMeta = (key: string) => {
    const cat = CONTENT_CATEGORIES.find((c) => c.key === key);
    if (!cat) return { label: key, Icon: FileText };
    return { label: cat.label, Icon: ICON_MAP[cat.icon] || FileText };
  };

  const getItemIcon = (index: number) => CYCLE_ICONS[index % CYCLE_ICONS.length];

  const handleSelect = (item: ContentItem) => {
    onSelect(item.text);
    setOpen(false);
  };

  const openEdit = (item: ContentItem, globalIndex: number) => {
    setEditItem({ item, index: globalIndex });
    setEditName(item.name);
    setEditText(item.text);
  };

  const saveEdit = () => {
    if (!editItem || !editName.trim()) return;
    const updated = [...items];
    updated[editItem.index] = { ...updated[editItem.index], name: editName.trim(), text: editText.trim() };
    updateSetting.mutate(
      { key: settingsKey, value: JSON.stringify(updated) },
      { onSuccess: () => { toast({ title: "Salvato" }); setEditItem(null); } },
    );
  };

  // Build a flat index map for grouped items
  const flatIndexMap = useMemo(() => {
    const map = new Map<ContentItem, number>();
    items.forEach((item, idx) => map.set(item, idx));
    return map;
  }, [items]);

  const selectedName = items.find((i) => i.text === selectedText)?.name;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-7 text-xs gap-1.5 justify-start", className)}
          >
            <Target className="w-3.5 h-3.5 text-primary" />
            {selectedName ? (
              <span className="truncate max-w-[180px]">{selectedName}</span>
            ) : (
              <span className="text-muted-foreground">{triggerLabel || `Seleziona ${label.toLowerCase()}...`}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0 max-h-[400px] overflow-y-auto" align="start">
          <div className="px-3 py-2 border-b border-border/50">
            <p className="text-xs font-semibold text-foreground">{label}</p>
            <p className="text-[10px] text-muted-foreground">Seleziona o modifica</p>
          </div>

          <div className="p-2 space-y-3">
            {Object.entries(grouped).map(([catKey, catItems]) => {
              const { label: catLabel, Icon: CatIcon } = getCategoryMeta(catKey);
              return (
                <div key={catKey}>
                  <div className="flex items-center gap-1.5 mb-1.5 px-1">
                    <CatIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {catLabel}
                    </span>
                    <Badge variant="secondary" className="h-4 px-1 text-[9px]">{catItems.length}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {catItems.map((item) => {
                      const globalIdx = flatIndexMap.get(item) ?? 0;
                      const ItemIcon = getItemIcon(globalIdx);
                      const isSelected = item.text === selectedText;
                      return (
                        <div
                          key={globalIdx}
                          className={cn(
                           "group relative rounded-lg border p-2 cursor-pointer transition-all hover:border-primary/40 hover:bg-primary/5",
                            isSelected ? "border-primary/50 bg-primary/10" : "border-border bg-card",
                          )}
                          onClick={() => handleSelect(item)}
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(item, globalIdx); }}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-muted/80 hover:bg-muted"
                          >
                            <Pencil className="w-2.5 h-2.5 text-muted-foreground" />
                          </button>
                          <div className="flex flex-col items-center gap-1 text-center">
                            <ItemIcon className={cn("w-5 h-5", isSelected ? "text-primary" : "text-muted-foreground")} />
                            <span className="text-[10px] font-medium leading-tight line-clamp-2">
                              {item.name}
                            </span>
                            {isSelected && <Check className="w-3 h-3 text-primary" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(v) => !v && setEditItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Modifica {label}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modifica il nome e il testo del contenuto
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Nome</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm mt-1" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Testo</label>
              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)}
                className="min-h-[120px] text-sm mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditItem(null)}>Annulla</Button>
            <Button size="sm" onClick={saveEdit} disabled={updateSetting.isPending}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

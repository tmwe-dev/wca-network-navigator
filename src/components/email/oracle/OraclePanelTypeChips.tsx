import { useState } from "react";
import { Plus, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { EmailType } from "@/data/defaultEmailTypes";

const CHIP_LABELS: Record<string, string> = {
  primo_contatto: "Primo",
  follow_up: "Follow",
  richiesta_info: "Info",
  proposta: "Proposta",
  partnership: "Partner",
  network_espresso: "Express",
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {};

interface ChipsProps {
  allTypes: EmailType[];
  selectedType: EmailType | null;
  customTypes: EmailType[];
  onSelectType: (type: EmailType | null) => void;
  onAddType: (type: EmailType) => void;
  onRemoveType: (id: string) => void;
  onOpenDetail: (type: EmailType) => void;
}

export function OraclePanelTypeChips({
  allTypes,
  selectedType,
  customTypes,
  onSelectType,
  onAddType,
  onRemoveType,
  onOpenDetail,
}: ChipsProps) {
  const [showNewType, setShowNewType] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📧");
  const [newPrompt, setNewPrompt] = useState("");
  const [newTone, setNewTone] = useState("professionale");

  const handleAddType = () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    const type: EmailType = {
      id: `custom_${Date.now()}`,
      name: newName.trim(),
      icon: newIcon || "📧",
      category: "altro",
      prompt: newPrompt.trim(),
      tone: newTone,
    };
    onAddType(type);
    setNewName("");
    setNewIcon("📧");
    setNewPrompt("");
    setNewTone("professionale");
    setShowNewType(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {allTypes.map((t) => {
          const isSelected = selectedType?.id === t.id;
          const isCustom = customTypes.some((c) => c.id === t.id);
          const chipLabel = CHIP_LABELS[t.id] || t.name;

          return (
            <div key={t.id} className="flex items-center shrink-0">
              <button
                onClick={() => onSelectType(isSelected ? null : t)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] border whitespace-nowrap transition-all",
                  isSelected
                    ? "bg-primary/15 ring-1 ring-primary/30 border-primary/30 text-primary font-medium"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                {ICON_MAP[t.icon] ? (
                  (() => {
                    const Icon = ICON_MAP[t.icon];
                    return <Icon className="w-3.5 h-3.5 text-current" />;
                  })()
                ) : (
                  <span className="text-xs">{t.icon}</span>
                )}
                <span>{chipLabel}</span>
                {isCustom && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveType(t.id);
                    }}
                    className="ml-0.5 hover:text-destructive"
                  >
                    <X className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
              {isSelected && (
                <button
                  onClick={() => onOpenDetail(t)}
                  className="shrink-0 p-0.5 ml-0.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                  title="Dettaglio tipo"
                >
                  <Info className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={() => setShowNewType(!showNewType)}
          className={cn(
            "shrink-0 flex items-center gap-0.5 px-2 py-1 rounded-full text-[10px] border transition-colors",
            showNewType
              ? "border-primary/30 text-primary bg-primary/10"
              : "border-border text-muted-foreground hover:border-primary/30"
          )}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {showNewType && (
        <div className="p-2 rounded-lg bg-muted/30 space-y-1.5 border border-border/30">
          <div className="flex gap-1.5">
            <Input
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              className="w-10 h-7 text-center text-sm px-1"
              maxLength={2}
            />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome tipo"
              className="flex-1 h-7 text-xs"
            />
          </div>
          <Textarea
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            placeholder="Prompt / obiettivo..."
            className="text-xs min-h-[60px] resize-none"
            rows={3}
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="default"
              className="h-6 text-[10px] flex-1"
              onClick={handleAddType}
            >
              Salva
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px]"
              onClick={() => setShowNewType(false)}
            >
              Annulla
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

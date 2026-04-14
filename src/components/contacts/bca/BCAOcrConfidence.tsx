/**
 * BCAOcrConfidence — Per-field OCR quality display with inline editing
 */
import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Pencil, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateBusinessCard, type BusinessCardWithPartner } from "@/hooks/useBusinessCards";
import { toast } from "@/hooks/use-toast";

const OCR_FIELDS = [
  { key: "company_name", label: "Azienda" },
  { key: "contact_name", label: "Nome" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefono" },
  { key: "mobile", label: "Cellulare" },
  { key: "position", label: "Posizione" },
] as const;

type OcrFieldKey = (typeof OCR_FIELDS)[number]["key"];

function ConfidenceDot({ confidence }: { confidence: number | undefined }) {
  if (confidence == null) return <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />;
  const color = confidence > 90 ? "bg-emerald-500" : confidence > 70 ? "bg-amber-500" : "bg-destructive";
  return (
    <span className="flex items-center gap-1 shrink-0">
      <span className={cn("w-2 h-2 rounded-full", color)} />
      <span className="text-[9px] text-muted-foreground">{Math.round(confidence)}%</span>
    </span>
  );
}

export function BCAOcrConfidence({ card }: { card: BusinessCardWithPartner }) {
  const updateCard = useUpdateBusinessCard();
  const [editing, setEditing] = useState<OcrFieldKey | null>(null);
  const [editValue, setEditValue] = useState("");

  const ocrConf = (card as any).ocr_confidence as Record<string, number> | null;
  const manuallyCorrected = (card as any).manually_corrected as boolean | null;

  const startEdit = useCallback((field: OcrFieldKey) => {
    setEditing(field);
    setEditValue((card[field as keyof typeof card] as string) ?? "");
  }, [card]);

  const saveEdit = useCallback(async () => {
    if (!editing) return;
    const oldValue = (card[editing as keyof typeof card] as string) ?? "";
    if (editValue === oldValue) { setEditing(null); return; }

    const existingNotes = (card as any).correction_notes;
    let notes: Array<Record<string, unknown>> = [];
    try { notes = existingNotes ? JSON.parse(existingNotes) : []; } catch { notes = []; }
    notes.push({ field: editing, old_value: oldValue, new_value: editValue, corrected_at: new Date().toISOString() });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic field update
      await updateCard.mutateAsync({
        id: card.id,
        [editing]: editValue || null,
        manually_corrected: true,
        correction_notes: JSON.stringify(notes),
      } as any);
      toast({ title: "✓ Campo corretto" });
      setEditing(null);
    } catch (e: unknown) {
      toast({ title: "Errore", description: e instanceof Error ? (e instanceof Error ? e.message : String(e)) : String(e), variant: "destructive" });
    }
  }, [editing, editValue, card, updateCard]);

  return (
    <div className="space-y-1.5 bg-muted/20 rounded-lg p-3 border border-border/30">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Qualità OCR</p>
        {manuallyCorrected && (
          <Badge variant="outline" className="text-[9px] border-primary/30 text-primary gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" /> Verificato
          </Badge>
        )}
      </div>

      <div className="space-y-1">
        {OCR_FIELDS.map(({ key, label }) => {
          const value = card[key as keyof typeof card] as string | null;
          const confidence = ocrConf?.[key];
          const isLow = confidence != null && confidence < 70;
          const isEditing = editing === key;

          return (
            <div key={key} className={cn(
              "flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-colors",
              isLow && !isEditing && "bg-amber-500/10 border border-amber-500/20",
            )}>
              <span className="text-[10px] text-muted-foreground w-16 shrink-0">{label}</span>
              <ConfidenceDot confidence={confidence} />

              {isEditing ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-6 text-xs flex-1"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }}
                  />
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={saveEdit}>
                    <Save className="w-3 h-3 text-emerald-500" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditing(null)}>
                    <X className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <span className={cn("truncate flex-1", value ? "text-foreground" : "text-muted-foreground/50 italic")}>
                    {value || "—"}
                  </span>
                  <button
                    onClick={() => startEdit(key)}
                    className={cn("p-0.5 rounded hover:bg-muted/50 transition-colors shrink-0", isLow && "animate-pulse")}
                  >
                    <Pencil className={cn("w-3 h-3", isLow ? "text-amber-500" : "text-muted-foreground/50")} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

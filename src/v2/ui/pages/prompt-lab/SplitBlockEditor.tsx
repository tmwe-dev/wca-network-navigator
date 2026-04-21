/**
 * SplitBlockEditor — Componente core per Prompt Lab.
 * Sinistra: editabile. Destra: proposta AI con accept/discard.
 */
import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Save } from "lucide-react";
import type { Block } from "./types";
import { cn } from "@/lib/utils";

interface SplitBlockEditorProps {
  blocks: ReadonlyArray<Block>;
  onChange: (id: string, content: string) => void;
  onAccept: (id: string) => void;
  onDiscard: (id: string) => void;
  onImprove?: (id: string) => void;
  onSave?: (id: string) => void;
  saving?: string | null;
}

export function SplitBlockEditor({
  blocks,
  onChange,
  onAccept,
  onDiscard,
  onImprove,
  onSave,
  saving,
}: SplitBlockEditorProps) {
  if (blocks.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-12">
        Nessun blocco da mostrare per questa sezione.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {blocks.map((block) => (
        <div key={block.id} className="grid grid-cols-2 gap-3 border-b py-3">
          {/* LEFT: editable */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                {block.label}
                {block.dirty && <span className="ml-1.5 text-amber-600">●</span>}
              </label>
              <div className="flex items-center gap-1">
                {onImprove && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => onImprove(block.id)}
                  >
                    <Sparkles className="h-3 w-3" /> Migliora
                  </Button>
                )}
                {onSave && block.dirty && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    disabled={saving === block.id}
                    onClick={() => onSave(block.id)}
                  >
                    <Save className="h-3 w-3" /> {saving === block.id ? "..." : "Salva"}
                  </Button>
                )}
              </div>
            </div>
            {block.hint && <p className="text-[10px] text-muted-foreground">{block.hint}</p>}
            <Textarea
              value={block.content}
              onChange={(e) => onChange(block.id, e.target.value)}
              className="font-mono text-xs min-h-[80px] resize-y"
            />
          </div>

          {/* RIGHT: improved */}
          <div
            className={cn(
              "rounded-md p-2 relative border",
              block.improved
                ? "bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800"
                : "bg-muted/30 border-dashed",
            )}
          >
            <label className="text-xs font-medium text-green-700 dark:text-green-400">
              {block.label} — migliorato
            </label>
            <div className="font-mono text-xs whitespace-pre-wrap mt-1 pr-16 max-h-[400px] overflow-auto">
              {block.improved ?? (
                <span className="text-muted-foreground italic">
                  Nessun miglioramento — usa la chat o il pulsante Migliora
                </span>
              )}
            </div>
            {block.improved && (
              <div className="absolute top-1 right-1 flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => onAccept(block.id)}
                  title="Accetta"
                >
                  <Check className="h-3 w-3 text-green-700" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => onDiscard(block.id)}
                  title="Scarta"
                >
                  <X className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
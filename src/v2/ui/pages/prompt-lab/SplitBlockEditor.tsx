/**
 * SplitBlockEditor — Componente core per Prompt Lab.
 * Carousel orizzontale: un blocco alla volta a piena altezza.
 * Sinistra: editabile. Destra: proposta AI con accept/discard.
 */
import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Save, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [index, setIndex] = React.useState(0);

  // Clamp index quando la lista cambia
  React.useEffect(() => {
    if (index > blocks.length - 1) setIndex(Math.max(0, blocks.length - 1));
  }, [blocks.length, index]);

  const go = React.useCallback(
    (delta: number) => {
      if (blocks.length === 0) return;
      setIndex((i) => (i + delta + blocks.length) % blocks.length);
    },
    [blocks.length],
  );

  // Navigazione tastiera (← →)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["TEXTAREA", "INPUT"].includes(e.target.tagName)) return;
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (blocks.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-12">
        Nessun blocco da mostrare per questa sezione.
      </div>
    );
  }

  const block = blocks[Math.min(index, blocks.length - 1)];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar carousel: prev / titolo+contatore / next */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b mb-3 flex-shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2"
          onClick={() => go(-1)}
          disabled={blocks.length < 2}
          aria-label="Blocco precedente"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 min-w-0 flex items-center justify-center gap-2">
          <span className="text-xs font-semibold truncate">{block.label}</span>
          {block.dirty && <span className="text-amber-600 text-xs">●</span>}
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {index + 1} / {blocks.length}
          </span>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2"
          onClick={() => go(1)}
          disabled={blocks.length < 2}
          aria-label="Blocco successivo"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Indicatori (puntini) — solo se pochi blocchi */}
      {blocks.length > 1 && blocks.length <= 20 && (
        <div className="flex items-center justify-center gap-1 pb-2 flex-shrink-0 flex-wrap">
          {blocks.map((b, i) => (
            <button
              key={b.id}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-6 bg-primary" : "w-1.5 bg-muted hover:bg-muted-foreground/40",
              )}
              aria-label={`Vai al blocco ${i + 1}: ${b.label}`}
              title={b.label}
            />
          ))}
        </div>
      )}

      {/* Pannello blocco corrente — split sinistra/destra a piena altezza */}
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        {/* LEFT: editable */}
        <div className="flex flex-col min-h-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-shrink-0">
            <label className="text-xs font-medium text-muted-foreground">Originale</label>
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
          {block.hint && (
            <p className="text-[10px] text-muted-foreground flex-shrink-0">{block.hint}</p>
          )}
          <Textarea
            value={block.content}
            onChange={(e) => onChange(block.id, e.target.value)}
            className="font-mono text-xs flex-1 min-h-0 resize-none"
          />
        </div>

        {/* RIGHT: improved */}
        <div
          className={cn(
            "rounded-md p-3 relative border flex flex-col min-h-0",
            block.improved
              ? "bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800"
              : "bg-muted/30 border-dashed",
          )}
        >
          <label className="text-xs font-medium text-green-700 dark:text-green-400 flex-shrink-0">
            Versione migliorata
          </label>
          <div className="font-mono text-xs whitespace-pre-wrap mt-1 pr-16 flex-1 min-h-0 overflow-auto">
            {block.improved ?? (
              <span className="text-muted-foreground italic">
                Nessun miglioramento — usa la chat o il pulsante Migliora
              </span>
            )}
          </div>
          {block.improved && (
            <div className="absolute top-2 right-2 flex gap-1">
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
    </div>
  );
}
/**
 * SplitBlockEditor — Componente core per Prompt Lab.
 * Layout: lista verticale dei blocchi a sinistra + editor full-width a destra.
 * Quando l'AI propone una versione migliorata, mostra un diff inline (linee
 * verdi/rosse) sotto/sopra l'editor invece di due colonne separate.
 */
import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Save } from "lucide-react";
import type { Block } from "./types";
import { cn } from "@/lib/utils";
import { diffLines } from "diff";

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
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showDiff, setShowDiff] = React.useState(true);

  // Mantieni una selezione valida quando cambia la lista
  React.useEffect(() => {
    if (blocks.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !blocks.some((b) => b.id === selectedId)) {
      setSelectedId(blocks[0].id);
    }
  }, [blocks, selectedId]);

  if (blocks.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-12">
        Nessun blocco da mostrare per questa sezione.
      </div>
    );
  }

  const block = blocks.find((b) => b.id === selectedId) ?? blocks[0];

  return (
    <div className="flex h-full min-h-0 gap-3">
      {/* SIDEBAR — lista blocchi */}
      <aside className="w-56 flex-shrink-0 flex flex-col min-h-0 border rounded-md bg-card/30">
        <div className="px-2.5 py-1.5 border-b text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Blocchi · {blocks.length}
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          {blocks.map((b, i) => {
            const isActive = b.id === block.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors",
                  isActive
                    ? "bg-primary/15 text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                )}
                title={b.label}
              >
                <span className="tabular-nums text-[10px] text-muted-foreground/70 w-4 flex-shrink-0">
                  {i + 1}
                </span>
                <span className="truncate flex-1">{b.label}</span>
                {b.improved && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0"
                    title="Versione migliorata pronta"
                  />
                )}
                {b.dirty && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0"
                    title="Modifiche non salvate"
                  />
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* MAIN — editor full-width + diff inline */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 gap-2">
        {/* Toolbar blocco selezionato */}
        <div className="flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-semibold truncate">{block.label}</h3>
            {block.dirty && (
              <span className="text-[10px] text-amber-600 font-medium">non salvato</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {block.improved && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setShowDiff((v) => !v)}
                title="Mostra/nascondi diff"
              >
                {showDiff ? "Nascondi diff" : "Mostra diff"}
              </Button>
            )}
            {onImprove && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1"
                onClick={() => onImprove(block.id)}
                disabled={saving === block.id}
              >
                <Sparkles className="h-3 w-3" />
                {saving === block.id ? "..." : "Migliora con AI"}
              </Button>
            )}
            {onSave && (
              <Button
                size="sm"
                className="h-7 px-2.5 text-xs gap-1"
                disabled={!block.dirty || saving === block.id}
                onClick={() => onSave(block.id)}
              >
                <Save className="h-3 w-3" />
                Salva
              </Button>
            )}
          </div>
        </div>

        {block.hint && (
          <p className="text-[10px] text-muted-foreground flex-shrink-0">{block.hint}</p>
        )}

        {/* Editor full-width */}
        <Textarea
          value={block.content}
          onChange={(e) => onChange(block.id, e.target.value)}
          className={cn(
            "font-mono text-[13px] leading-relaxed resize-none p-3 min-h-0",
            block.improved && showDiff ? "flex-[1.2]" : "flex-1",
          )}
        />

        {/* Diff inline + accept/discard */}
        {block.improved && showDiff && (
          <div className="flex flex-col min-h-0 flex-[1.5] border border-green-300 dark:border-green-800 rounded-md bg-green-50/50 dark:bg-green-950/20 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-green-200 dark:border-green-900 bg-green-100/50 dark:bg-green-950/40 flex-shrink-0">
              <span className="text-xs font-semibold text-green-800 dark:text-green-300">
                Proposta AI · diff inline
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs gap-1 text-green-700 dark:text-green-400 hover:bg-green-200/50"
                  onClick={() => onAccept(block.id)}
                >
                  <Check className="h-3 w-3" /> Accetta
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs gap-1 text-destructive hover:bg-destructive/10"
                  onClick={() => onDiscard(block.id)}
                >
                  <X className="h-3 w-3" /> Scarta
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto font-mono text-[12px] leading-relaxed">
              <InlineDiff original={block.content} improved={block.improved} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Render diff line-by-line: verde (aggiunto), rosso (rimosso), neutro (invariato). */
function InlineDiff({ original, improved }: { original: string; improved: string }): React.ReactElement {
  const parts = React.useMemo(() => diffLines(original, improved), [original, improved]);
  return (
    <div className="divide-y divide-border/30">
      {parts.map((p, i) => {
        const lines = p.value.replace(/\n$/, "").split("\n");
        const bg = p.added
          ? "bg-green-100/70 dark:bg-green-900/30"
          : p.removed
            ? "bg-red-100/70 dark:bg-red-900/30"
            : "bg-transparent";
        const prefix = p.added ? "+" : p.removed ? "−" : " ";
        const prefixColor = p.added
          ? "text-green-700 dark:text-green-400"
          : p.removed
            ? "text-red-700 dark:text-red-400"
            : "text-muted-foreground/40";
        return (
          <div key={i} className={cn("py-0.5", bg)}>
            {lines.map((ln, j) => (
              <div key={j} className="flex items-start px-3">
                <span className={cn("inline-block w-4 select-none flex-shrink-0", prefixColor)}>{prefix}</span>
                <span className={cn("whitespace-pre-wrap break-words flex-1", p.removed && "line-through opacity-70")}>
                  {ln || "\u00A0"}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
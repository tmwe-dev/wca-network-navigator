/**
 * DiffViewer — render line-by-line di un diff testuale con righe colorate.
 * Verde per aggiunte, rosso per rimozioni, neutro per contesto.
 * Presentational puro: il diff viene calcolato dal chiamante (computeLineDiff).
 */
import { useMemo } from "react";
import { computeLineDiff } from "@/lib/textDiff";
import { cn } from "@/lib/utils";

interface Props {
  before: string;
  after: string;
  className?: string;
  /** Se true, mostra solo righe modificate + 1 riga di contesto sopra/sotto. */
  compact?: boolean;
}

export function DiffViewer({ before, after, className, compact = false }: Props) {
  const lines = useMemo(() => computeLineDiff(before, after), [before, after]);

  const visible = useMemo(() => {
    if (!compact) return lines.map((l, i) => ({ ...l, idx: i }));
    // Mantieni righe modificate + 1 di contesto sopra/sotto
    const keep = new Set<number>();
    lines.forEach((l, i) => {
      if (l.type !== "context") {
        keep.add(i);
        if (i > 0) keep.add(i - 1);
        if (i < lines.length - 1) keep.add(i + 1);
      }
    });
    return lines
      .map((l, i) => ({ ...l, idx: i }))
      .filter((l) => keep.has(l.idx));
  }, [lines, compact]);

  const stats = useMemo(() => {
    let add = 0;
    let rem = 0;
    for (const l of lines) {
      if (l.type === "add") add++;
      else if (l.type === "remove") rem++;
    }
    return { add, rem };
  }, [lines]);

  if (stats.add === 0 && stats.rem === 0) {
    return (
      <div className={cn("text-[11px] text-muted-foreground italic px-2 py-1", className)}>
        Nessuna differenza.
      </div>
    );
  }

  return (
    <div className={cn("rounded border bg-background overflow-hidden", className)}>
      <div className="flex items-center gap-2 border-b bg-muted/40 px-2 py-1 text-[10px]">
        <span className="text-emerald-600 dark:text-emerald-400 font-mono">+{stats.add}</span>
        <span className="text-destructive font-mono">−{stats.rem}</span>
        <span className="text-muted-foreground ml-auto">diff line-by-line</span>
      </div>
      <div className="font-mono text-[11px] leading-relaxed overflow-auto max-h-[420px]">
        {visible.map((l, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2 px-2 whitespace-pre-wrap break-words",
              l.type === "add" && "bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
              l.type === "remove" && "bg-destructive/10 text-destructive line-through opacity-90",
              l.type === "context" && "text-muted-foreground",
            )}
          >
            <span className="select-none w-4 flex-shrink-0 text-right opacity-60">
              {l.type === "add" ? "+" : l.type === "remove" ? "−" : " "}
            </span>
            <span className="flex-1">{l.text || " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

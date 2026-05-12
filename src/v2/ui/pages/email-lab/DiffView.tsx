/**
 * DiffView — diff word-level fra due testi (no dipendenze esterne).
 * Algoritmo LCS classico, sufficiente per body email brevi (<5k char).
 */
import * as React from "react";

interface Props {
  before: string;
  after: string;
  className?: string;
}

type Op = { type: "eq" | "add" | "del"; text: string };

function tokenize(s: string): string[] {
  // Split mantenendo separatori (spazi, newline, punteggiatura) come token a sé.
  return s.split(/(\s+|[.,;:!?()\[\]{}"'`])/).filter((t) => t.length > 0);
}

function diffTokens(a: string[], b: string[]): Op[] {
  const m = a.length, n = b.length;
  // LCS table — bounded perché tokens email <= ~2k
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { ops.push({ type: "eq", text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: "del", text: a[i] }); i++; }
    else { ops.push({ type: "add", text: b[j] }); j++; }
  }
  while (i < m) { ops.push({ type: "del", text: a[i++] }); }
  while (j < n) { ops.push({ type: "add", text: b[j++] }); }
  return ops;
}

function stripHtml(s: string): string {
  return s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "");
}

export function DiffView({ before, after, className }: Props): React.ReactElement {
  const ops = React.useMemo(() => {
    const a = tokenize(stripHtml(before));
    const b = tokenize(stripHtml(after));
    if (a.length + b.length > 6000) {
      // Fallback: troppo grande, mostra solo "after" senza colorare.
      return [{ type: "eq" as const, text: stripHtml(after) }];
    }
    return diffTokens(a, b);
  }, [before, after]);

  return (
    <div className={`whitespace-pre-wrap text-sm leading-relaxed ${className ?? ""}`}>
      {ops.map((op, i) => {
        if (op.type === "eq") return <span key={i} className="text-foreground/85">{op.text}</span>;
        if (op.type === "add") return <span key={i} className="bg-emerald-500/20 text-emerald-300 rounded-sm px-0.5">{op.text}</span>;
        return <span key={i} className="bg-rose-500/20 text-rose-300 rounded-sm px-0.5 line-through">{op.text}</span>;
      })}
    </div>
  );
}
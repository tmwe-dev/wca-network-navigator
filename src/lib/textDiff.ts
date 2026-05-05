/**
 * textDiff — Utility minimale per generare un diff line-by-line tra due stringhe.
 * Usa Longest Common Subsequence (LCS) classico, performante per blocchi di prompt
 * (tipicamente < 500 righe). Output array di hunks {type, text} renderizzabile in UI
 * e una versione testuale stile unified-diff per persistenza in DB (`diff_text`).
 */

export type DiffLineType = "context" | "add" | "remove";

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

function splitLines(s: string): string[] {
  if (!s) return [];
  return s.replace(/\r\n/g, "\n").split("\n");
}

/** Calcola diff line-by-line via LCS. Ritorna un array ordinato di righe annotate. */
export function computeLineDiff(before: string, after: string): DiffLine[] {
  const a = splitLines(before);
  const b = splitLines(after);
  const n = a.length;
  const m = b.length;

  // LCS DP table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "context", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "remove", text: a[i] });
      i++;
    } else {
      out.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) {
    out.push({ type: "remove", text: a[i++] });
  }
  while (j < m) {
    out.push({ type: "add", text: b[j++] });
  }
  return out;
}

/** Serializza il diff in formato testuale unified-like per persistenza/storage. */
export function diffToText(lines: DiffLine[]): string {
  return lines
    .map((l) => {
      const prefix = l.type === "add" ? "+" : l.type === "remove" ? "-" : " ";
      return `${prefix} ${l.text}`;
    })
    .join("\n");
}

/** Helper convenience: produce direttamente la stringa serializzata. */
export function buildDiffText(before: string, after: string): string {
  return diffToText(computeLineDiff(before, after));
}

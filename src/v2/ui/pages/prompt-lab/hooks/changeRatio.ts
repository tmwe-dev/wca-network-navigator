/**
 * changeRatio — calcolo veloce del delta testuale fra `before` e `after`
 * usato dal "Migliora tutto" per distinguere riscritture sostanziali
 * da variazioni puramente cosmetiche.
 *
 * Non è una vera Levenshtein normalizzata — sarebbe O(n*m) e con prompt
 * lunghi diventa pesante. Usiamo invece due segnali combinati:
 *  1. delta lunghezza assoluta normalizzata
 *  2. word-level Jaccard distance (1 - intersezione / unione)
 * e ne prendiamo il massimo: se anche solo uno dei due è alto,
 * c'è cambiamento sostanziale.
 */

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function tokenize(s: string): Set<string> {
  return new Set(normalize(s).split(/[\s.,;:!?()\[\]{}"'`]+/).filter((t) => t.length > 1));
}

/**
 * Ritorna un valore in [0, 1].
 *  - 0 = identici (post-normalizzazione)
 *  - 0.05 ~ qualche parola/punteggiatura cambiata
 *  - 0.20+ = riscrittura sostanziale
 *  - 1 = nessun token in comune
 */
export function computeChangeRatio(before: string, after: string): number {
  const a = normalize(before);
  const b = normalize(after);
  if (a === b) return 0;
  if (!a || !b) return 1;

  const lenDelta = Math.abs(a.length - b.length) / Math.max(a.length, b.length, 1);

  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 && tb.size === 0) return lenDelta;

  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  const jaccardDist = union === 0 ? 0 : 1 - inter / union;

  return Math.max(lenDelta, jaccardDist);
}

/** Soglia sotto la quale un intervento è considerato cosmetico. */
export const MINOR_CHANGE_THRESHOLD = 0.05;
/**
 * Pure helpers for contact similarity / fuzzy dedup.
 * Estratti da src/hooks/useContactMerge.ts per rimuovere la reimplementazione
 * in src/test/contact-merge-logic.test.ts (P001-025 / batch F20-P0.2).
 *
 * NON aggiungere qui side-effect, IO, o logica di dominio: modulo puro.
 * Il comportamento deve restare byte-identico agli originali privati:
 *  - lowercase + trim su entrambi gli input
 *  - matrice Wagner–Fischer classica, insertion/deletion/substitution cost 1
 *  - extractDomain(email): split("@"), parts[1] o "" (compat: multi-@ ritorna il segmento tra il primo e il secondo @)
 *  - calculateSimilarity: 1 - distance / max(len), 0 se un input è null/vuoto
 */

export function levenshteinDistance(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  if (aLower === bLower) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= aLower.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      const cost = aLower[j - 1] === bLower[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j] + 1, // deletion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[bLower.length][aLower.length];
}

export function extractDomain(email: string | null): string {
  if (!email) return "";
  const parts = email.toLowerCase().split("@");
  return parts.length > 1 ? parts[1] : "";
}

export function calculateSimilarity(name1: string | null, name2: string | null): number {
  if (!name1 || !name2) return 0;
  const distance = levenshteinDistance(name1, name2);
  const maxLength = Math.max(name1.length, name2.length);
  return maxLength > 0 ? 1 - distance / maxLength : 0;
}

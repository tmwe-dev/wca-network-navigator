/**
 * kbContext — Loads relevant KB entries for a given prompt.
 * Uses full-text search (Italian) with fuzzy title fallback.
 */
import { findKbContextByFullText, findKbContextByTitleFuzzy } from "@/data/kbEntries";

export type KbContextEntry = {
  readonly title: string;
  readonly category: string;
  readonly content: string;
  readonly source_path: string | null;
};

/**
 * Carica le entry KB più rilevanti per il prompt dato.
 * 1. Full-text search italiano su content
 * 2. Fallback: fuzzy match su title (prima parola significativa)
 */
export async function loadKbContext(prompt: string, limit = 5): Promise<readonly KbContextEntry[]> {
  const cleaned = prompt.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  if (!cleaned) return [];

  // Full-text search su content
  const ftsData = await findKbContextByFullText(cleaned, limit);
  if (ftsData.length > 0) return ftsData;

  // Fallback: fuzzy match su title (prima parola > 3 chars)
  const firstWord = cleaned.split(/\s+/).find((w) => w.length > 3) ?? cleaned.split(/\s+/)[0];
  if (!firstWord) return [];

  return findKbContextByTitleFuzzy(firstWord, limit);
}

/**
 * entityMatcher — Scoring multi-candidato deterministic (NO AI).
 *
 * Per ogni entità in arrivo dal parser, individua i top-N candidati
 * potenzialmente corrispondenti nel CompactIndex.
 *
 * Strategie di scoring:
 *  1. Match esatto titolo:
 *      - same table → score 100
 *      - cross table → score 60
 *  2. Containment parziale (a in b OR b in a):
 *      - same table → 70
 *      - cross table → 40
 *  3. Token overlap (parole chiave ≥4 char, intersezione ≥2):
 *      - same table → 50
 *      - cross table → 30
 *
 * Output: array ordinato per score DESC, max 3 candidati con score > 0.
 */
import type { CompactIndex, IndexEntry } from "./compactIndex";
import type { EntityToParse } from "./entityParser";

const STOPWORDS = new Set([
  "il", "lo", "la", "i", "gli", "le", "un", "una", "uno", "del", "della", "dei",
  "delle", "degli", "dal", "dalla", "in", "con", "per", "tra", "fra", "che", "chi",
  "non", "più", "meno", "come", "dove", "quando", "quale", "the", "and", "for",
  "with", "from", "this", "that", "into", "onto", "such", "your", "their", "have",
  "will", "shall", "must",
]);

export interface MatchCandidate {
  entry: IndexEntry;
  score: number;
  /** Spiegazione human-readable del match (utile per UI/debug). */
  reason: string;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokens(s: string): Set<string> {
  const out = new Set<string>();
  for (const raw of s.toLowerCase().split(/[^a-zàèéìòù0-9]+/)) {
    const t = raw.trim();
    if (t.length >= 4 && !STOPWORDS.has(t)) out.add(t);
  }
  return out;
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

/**
 * Trova i top candidati per matching nell'index.
 * @param entity entità in arrivo dal parser
 * @param index snapshot DB
 * @param limit max candidati restituiti (default 3)
 */
export function findCandidates(
  entity: EntityToParse,
  index: CompactIndex,
  limit = 3,
): MatchCandidate[] {
  const eTitle = normalize(entity.title);
  const eTokens = tokens(`${entity.title} ${entity.content.slice(0, 500)}`);
  const candidates = new Map<string, MatchCandidate>();

  // 1. Lookup per titolo esatto.
  const exact = index.byTitle.get(eTitle);
  if (exact) {
    for (const r of exact) {
      const sameTable = r.table === entity.inferredTable;
      candidates.set(r.id, {
        entry: r,
        score: sameTable ? 100 : 60,
        reason: sameTable
          ? "Titolo identico, stessa tabella"
          : `Titolo identico, tabella diversa (${r.table})`,
      });
    }
  }

  // 2. Containment + token overlap su tutti gli entry (limitato a same-table + un sottoinsieme cross-table per perf).
  const sameTableEntries = index.byTable.get(entity.inferredTable) ?? [];
  const otherEntries: IndexEntry[] = [];
  for (const [t, list] of index.byTable.entries()) {
    if (t !== entity.inferredTable) otherEntries.push(...list);
  }
  const allToScan = [...sameTableEntries, ...otherEntries];

  for (const r of allToScan) {
    if (candidates.has(r.id)) continue;
    const rTitle = normalize(r.title);
    const sameTable = r.table === entity.inferredTable;

    // 2a. containment
    if (rTitle.length >= 4 && eTitle.length >= 4) {
      if (rTitle.includes(eTitle) || eTitle.includes(rTitle)) {
        candidates.set(r.id, {
          entry: r,
          score: sameTable ? 70 : 40,
          reason: sameTable
            ? "Titolo contenuto/contenente, stessa tabella"
            : `Titolo simile, tabella ${r.table}`,
        });
        continue;
      }
    }

    // 2b. token overlap
    const rTokens = tokens(r.title);
    if (rTokens.size === 0) continue;
    const overlap = intersectionSize(eTokens, rTokens);
    if (overlap >= 2) {
      candidates.set(r.id, {
        entry: r,
        score: sameTable ? 50 : 30,
        reason: `${overlap} parole chiave in comune (${sameTable ? "stessa" : "diversa"} tabella)`,
      });
    }
  }

  return [...candidates.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

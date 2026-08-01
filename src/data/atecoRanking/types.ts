/**
 * ATECO Ranking per Spedizioniere Internazionale / Corriere Espresso
 *
 * Ranking corretto e differenziato per sotto-categoria.
 * Ogni codice ATECO ha:
 *   - volume:  1-5  (volume spedizioni atteso)
 *   - valore:  1-5  (valore per kg della merce)
 *   - intl:    "MOLTO ALTO" | "ALTO" | "MEDIO" | "BASSO" | "MOLTO DIFFICILE"
 *   - paga:    "SI - ALTA PROBABILITÀ" | "SI - MEDIA PROBABILITÀ" | "POSSIBILE" | "IMPROBABILE"
 *   - note:    breve nota commerciale
 *
 * Lo score di priorità è calcolato: volume * valore * moltiplicatore_intl
 */

export interface AtecoRank {
  volume: number;       // 1-5
  valore: number;       // 1-5
  intl: string;
  paga: string;
  note: string;
}

const INTL_MULT: Record<string, number> = {
  "MOLTO ALTO": 1.0,
  "ALTO": 0.8,
  "MEDIO": 0.5,
  "BASSO": 0.3,
  "MOLTO DIFFICILE": 0.1,
};

export function calcScore(r: AtecoRank): number {
  const base = r.volume + r.valore;
  const mult = INTL_MULT[r.intl] ?? 0.5;
  return Math.round(base * 2 * mult * 10) / 10;
}

/**
 * Map: codice ATECO → ranking
 * Copre livello 2 e 3. Per i livelli 1 (sezioni) si calcola la media dei figli.
 * Se un codice livello 3 non è presente, eredita dal livello 2.
 */

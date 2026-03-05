/**
 * Heuristic column mapper — adapted from clever-contact-loader
 * Maps source headers to our imported_contacts schema using
 * Italian synonyms + Levenshtein similarity + value analysis
 */
import { TARGET_SCHEMA, type ColumnMapping, type TransformationType, type TargetColumnKey } from "./types";

/** Italian synonym dictionary for each target field */
const SYNONYMS: Record<string, string[]> = {
  company_name: [
    "azienda", "company", "ditta", "ragione sociale", "rag. sociale", "rag sociale",
    "società", "societa", "impresa", "denominazione", "company name", "nome azienda",
    "ente", "organizzazione", "brand",
  ],
  company_alias: ["alias azienda", "nome breve", "short name", "company alias", "sigla"],
  name: [
    "nome", "contatto", "referente", "contact", "nome contatto", "nominativo",
    "nome e cognome", "nome cognome", "full name", "fullname", "first name", "firstname",
    "cognome", "last name", "lastname", "surname", "contact name", "person",
  ],
  contact_alias: ["alias contatto", "soprannome", "nickname", "contact alias"],
  position: [
    "ruolo", "posizione", "qualifica", "titolo", "role", "position", "job title",
    "mansione", "funzione", "carica", "title",
  ],
  email: [
    "email", "e-mail", "mail", "posta elettronica", "indirizzo email", "pec",
    "email address", "e mail",
  ],
  phone: [
    "telefono", "phone", "tel", "tel.", "telephone", "numero telefono",
    "n. telefono", "recapito", "fisso", "landline", "phone number",
  ],
  mobile: [
    "cellulare", "cell", "mobile", "cel", "cel.", "cell.", "smartphone",
    "numero cellulare", "mobile phone", "whatsapp",
  ],
  country: [
    "nazione", "country", "stato", "paese", "nation", "cod. nazione",
    "codice nazione", "country code", "naz",
  ],
  city: [
    "città", "citta", "city", "comune", "localita", "località", "town",
    "luogo", "sede",
  ],
  address: [
    "indirizzo", "via", "street", "address", "piazza", "corso", "viale",
    "strada", "loc.", "sede legale", "indirizzo completo",
  ],
  zip_code: [
    "cap", "postal code", "zip", "zipcode", "zip code", "codice postale",
    "c.a.p.", "codice avviamento", "postal_code", "postcode",
  ],
  origin: [
    "origine", "source", "provenienza", "sorgente", "origin", "fonte",
    "canale", "channel", "fiera", "evento", "event",
  ],
  external_id: [
    "codice", "id", "codice cliente", "customer id", "external id",
    "id esterno", "cod.", "matricola", "rif", "riferimento",
  ],
  note: [
    "note", "notes", "annotazioni", "commento", "commenti",
    "osservazioni", "descrizione", "memo",
  ],
};

function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/** Levenshtein distance */
function levenshtein(a: string, b: string): number {
  const m: number[][] = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = b[i - 1] === a[j - 1]
        ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[b.length][a.length];
}

function similarity(a: string, b: string): number {
  const normA = normalizeString(a);
  const normB = normalizeString(b);
  if (normA === normB) return 1;
  if (normA.includes(normB) || normB.includes(normA)) return 0.8;
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(normA, normB) / maxLen;
}

/** Detect appropriate transformation based on source → target relationship */
function detectTransformation(
  sourceHeader: string,
  targetKey: TargetColumnKey,
  _sampleValues: string[]
): TransformationType {
  const norm = normalizeString(sourceHeader);

  // Full name → split
  if (targetKey === "name" && (
    norm.includes("nome e cognome") || norm.includes("nominativo") || norm === "nome completo"
  )) {
    return "capitalize";
  }

  if (targetKey === "phone" || targetKey === "mobile") return "normalize_phone";
  if (targetKey === "email") return "extract_email";
  if (targetKey === "country") return "parse_country";
  if (targetKey === "name" || targetKey === "company_name" || targetKey === "city") return "capitalize";

  return "trim";
}

/**
 * Auto-map source headers to target schema columns.
 * Uses synonym dictionary + Levenshtein similarity.
 * Returns a mapping for every source column (unmapped ones have targetColumn = "").
 */
export function autoMapColumns(
  sourceHeaders: string[],
  sampleRows: string[][]
): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const usedTargets = new Set<string>();

  for (let i = 0; i < sourceHeaders.length; i++) {
    const sourceHeader = sourceHeaders[i];
    const normSource = normalizeString(sourceHeader);
    let bestMatch: TargetColumnKey | "" = "";
    let bestScore = 0;

    for (const col of TARGET_SCHEMA) {
      if (usedTargets.has(col.key)) continue;

      const synonyms = SYNONYMS[col.key] || [];
      let score = 0;

      // Check synonyms
      for (const syn of synonyms) {
        score = Math.max(score, similarity(normSource, normalizeString(syn)));
      }

      // Direct similarity with key and label
      score = Math.max(score, similarity(normSource, normalizeString(col.key)));
      score = Math.max(score, similarity(normSource, normalizeString(col.label)));

      if (score > bestScore) {
        bestScore = score;
        bestMatch = col.key;
      }
    }

    if (bestScore >= 0.5 && bestMatch) {
      const sampleValues = sampleRows.map(r => r[i] || "");
      usedTargets.add(bestMatch);
      mappings.push({
        sourceColumn: sourceHeader,
        sourceIndex: i,
        targetColumn: bestMatch,
        confidence: Math.round(bestScore * 100),
        transformation: detectTransformation(sourceHeader, bestMatch, sampleValues),
      });
    } else {
      mappings.push({
        sourceColumn: sourceHeader,
        sourceIndex: i,
        targetColumn: "",
        confidence: 0,
        transformation: "none",
      });
    }
  }

  return mappings;
}

/**
 * Convert heuristic mappings to the column_mapping dict format
 * used by the existing Import page (srcKey → targetCol)
 */
export function mappingsToDict(mappings: ColumnMapping[]): Record<string, string> {
  const dict: Record<string, string> = {};
  for (const m of mappings) {
    if (m.targetColumn) {
      dict[m.sourceColumn] = m.targetColumn;
    }
  }
  return dict;
}

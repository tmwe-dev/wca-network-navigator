/**
 * Pre-import transformations and validation
 * Philosophy: best-effort normalization, never reject for format issues
 * Only reject for truly empty rows or missing required fields
 */
import type { TransformationType, ColumnMapping, ValidationResult, RejectedRow } from "./types";
import { TARGET_COLUMNS } from "./types";

// ── Transformations ──────────────────────────────────────────────

export function applyTransformation(value: string, transformation: TransformationType): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return trimmed;

  switch (transformation) {
    case "trim":
      return trimmed;
    case "uppercase":
      return trimmed.toUpperCase();
    case "lowercase":
      return trimmed.toLowerCase();
    case "capitalize":
      return trimmed.replace(/\b\w/g, c => c.toUpperCase());
    case "normalize_phone":
      return normalizePhone(trimmed);
    case "extract_email":
      return extractEmail(trimmed);
    case "parse_country":
      return parseCountry(trimmed);
    default:
      return trimmed;
  }
}

export function normalizePhone(phone: string): string {
  const primaryCandidate = phone
    .split(/\s*(?:\||\/|;|,|\n|•)\s*/)
    .map((part) => part.trim())
    .find(Boolean) || phone;

  let cleaned = primaryCandidate.replace(/[\s\-.\(\)]/g, "");
  // Convert 00xx to +xx
  if (cleaned.startsWith("00")) cleaned = "+" + cleaned.slice(2);
  // Italian mobile (3xx) → +39
  if (cleaned.match(/^3\d{8,9}$/)) cleaned = "+39" + cleaned;
  // Italian landline (0xx) → +39
  if (cleaned.match(/^0\d{6,10}$/)) cleaned = "+39" + cleaned;
  return cleaned;
}

export function extractEmail(value: string): string {
  const match = value.match(/[\w.\-+]+@[\w.\-]+\.\w{2,}/);
  return match ? match[0].toLowerCase() : value.toLowerCase();
}

const COUNTRY_MAP: Record<string, string> = {
  "italia": "Italy", "italy": "Italy", "it": "Italy", "ita": "Italy",
  "germania": "Germany", "germany": "Germany", "de": "Germany", "deu": "Germany",
  "francia": "France", "france": "France", "fr": "France", "fra": "France",
  "spagna": "Spain", "spain": "Spain", "es": "Spain", "esp": "Spain",
  "regno unito": "United Kingdom", "united kingdom": "United Kingdom", "uk": "United Kingdom", "gb": "United Kingdom",
  "stati uniti": "United States", "united states": "United States", "usa": "United States", "us": "United States",
  "svizzera": "Switzerland", "switzerland": "Switzerland", "ch": "Switzerland",
  "austria": "Austria", "at": "Austria", "aut": "Austria",
  "olanda": "Netherlands", "paesi bassi": "Netherlands", "netherlands": "Netherlands", "nl": "Netherlands",
  "belgio": "Belgium", "belgium": "Belgium", "be": "Belgium",
  "portogallo": "Portugal", "portugal": "Portugal", "pt": "Portugal",
  "grecia": "Greece", "greece": "Greece", "gr": "Greece",
  "turchia": "Turkey", "turkey": "Turkey", "tr": "Turkey",
  "cina": "China", "china": "China", "cn": "China",
  "giappone": "Japan", "japan": "Japan", "jp": "Japan",
  "brasile": "Brazil", "brazil": "Brazil", "br": "Brazil",
  "india": "India", "in": "India",
  "russia": "Russia", "ru": "Russia",
  "messico": "Mexico", "mexico": "Mexico", "mx": "Mexico",
  "canada": "Canada", "ca": "Canada",
  "australia": "Australia", "au": "Australia",
  "emirati arabi": "United Arab Emirates", "uae": "United Arab Emirates", "ae": "United Arab Emirates",
  "arabia saudita": "Saudi Arabia", "saudi arabia": "Saudi Arabia", "sa": "Saudi Arabia",
  "corea del sud": "South Korea", "south korea": "South Korea", "kr": "South Korea",
  "singapore": "Singapore", "sg": "Singapore",
  "hong kong": "Hong Kong", "hk": "Hong Kong",
  "taiwan": "Taiwan", "tw": "Taiwan",
  "thailandia": "Thailand", "thailand": "Thailand", "th": "Thailand",
  "vietnam": "Vietnam", "vn": "Vietnam",
  "indonesia": "Indonesia", "id": "Indonesia",
  "malesia": "Malaysia", "malaysia": "Malaysia", "my": "Malaysia",
  "filippine": "Philippines", "philippines": "Philippines", "ph": "Philippines",
  "sudafrica": "South Africa", "south africa": "South Africa", "za": "South Africa",
  "egitto": "Egypt", "egypt": "Egypt", "eg": "Egypt",
  "nigeria": "Nigeria", "ng": "Nigeria",
  "kenya": "Kenya", "ke": "Kenya",
  "argentina": "Argentina", "ar": "Argentina",
  "cile": "Chile", "chile": "Chile", "cl": "Chile",
  "colombia": "Colombia", "co": "Colombia",
  "peru": "Peru", "perù": "Peru", "pe": "Peru",
  "polonia": "Poland", "poland": "Poland", "pl": "Poland",
  "romania": "Romania", "ro": "Romania",
  "ungheria": "Hungary", "hungary": "Hungary", "hu": "Hungary",
  "repubblica ceca": "Czech Republic", "czech republic": "Czech Republic", "cz": "Czech Republic",
  "svezia": "Sweden", "sweden": "Sweden", "se": "Sweden",
  "norvegia": "Norway", "norway": "Norway", "no": "Norway",
  "danimarca": "Denmark", "denmark": "Denmark", "dk": "Denmark",
  "finlandia": "Finland", "finland": "Finland", "fi": "Finland",
  "irlanda": "Ireland", "ireland": "Ireland", "ie": "Ireland",
};

export function parseCountry(value: string): string {
  const norm = value.toLowerCase().trim();
  return COUNTRY_MAP[norm] || value;
}

// ── Validation ──────────────────────────────────────────────────

function validateEmail(email: string): boolean {
  return /^[\w.\-+]+@[\w.\-]+\.\w{2,}$/.test(email);
}

/**
 * Validate and transform parsed rows using column mappings.
 * Philosophy: normalize best-effort, only reject truly empty rows.
 */
export function validateAndTransform(
  rows: string[][],
  mappings: ColumnMapping[],
): ValidationResult {
  const validRows: Record<string, string | null>[] = [];
  const rejectedRows: RejectedRow[] = [];
  const activeMappings = mappings.filter(m => m.targetColumn);

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const mapped: Record<string, string | null> = {};
    const reasons: string[] = [];

    // Apply mappings with transformations
    for (const mapping of activeMappings) {
      const rawValue = row[mapping.sourceIndex] ?? "";
      if (!rawValue.trim()) {
        mapped[mapping.targetColumn] = null;
        continue;
      }
      mapped[mapping.targetColumn] = applyTransformation(rawValue, mapping.transformation);
    }

    // Ensure all target columns exist (null if not mapped)
    for (const col of TARGET_COLUMNS) {
      if (!(col in mapped)) mapped[col] = null;
    }

    // Clean "NULL" strings
    for (const key of Object.keys(mapped)) {
      if (mapped[key] && mapped[key]!.toUpperCase() === "NULL") {
        mapped[key] = null;
      }
    }

    // Validate email format (best-effort: fix but don't reject)
    if (mapped.email && !validateEmail(mapped.email)) {
      // Try extracting
      const extracted = extractEmail(mapped.email);
      if (validateEmail(extracted)) {
        mapped.email = extracted;
      }
      // Don't reject — keep the raw value
    }

    // Phone normalization (always best-effort)
    if (mapped.phone) mapped.phone = normalizePhone(mapped.phone);
    if (mapped.mobile) mapped.mobile = normalizePhone(mapped.mobile);

    // Check if row has ANY meaningful data
    const hasData = Object.values(mapped).some(v => v?.trim());
    if (!hasData) {
      reasons.push("Riga vuota: nessun dato significativo");
    }

    if (reasons.length > 0) {
      rejectedRows.push({ rowIndex: rowIdx + 1, originalData: row, reasons, mappedData: mapped });
    } else {
      validRows.push(mapped);
    }
  }

  return {
    validRows,
    rejectedRows,
    stats: {
      totalRows: rows.length,
      importedCount: validRows.length,
      rejectedCount: rejectedRows.length,
    },
  };
}

/**
 * Apply transformations to a single row dict (used by existing Import page).
 * Takes a raw row object + column_mapping dict and returns transformed values.
 */
export function transformRow(
  row: Record<string, string | undefined>,
  columnMapping: Record<string, string>,
  heuristicMappings?: ColumnMapping[]
): Record<string, string | null> {
  const result: Record<string, string | null> = {};

  for (const [srcKey, dstCol] of Object.entries(columnMapping)) {
    if (!(TARGET_COLUMNS as readonly string[]).includes(dstCol)) continue;

    // Find actual key in row (fuzzy)
    const actualKey = findRowKey(row, srcKey);
    const rawVal = actualKey !== undefined ? row[actualKey] : undefined;

    if (!rawVal || !String(rawVal).trim() || String(rawVal).toUpperCase() === "NULL") {
      result[dstCol] = null;
      continue;
    }

    const val = String(rawVal).trim();

    // Find transformation from heuristic mappings if available
    const hMapping = heuristicMappings?.find(m => m.targetColumn === dstCol);
    const transformation = hMapping?.transformation || detectTransformForTarget(dstCol);

    result[dstCol] = applyTransformation(val, transformation);
  }

  return result;
}

/** Auto-detect transformation for a target column */
function detectTransformForTarget(targetCol: string): TransformationType {
  switch (targetCol) {
    case "phone":
    case "mobile":
      return "normalize_phone";
    case "email":
      return "extract_email";
    case "country":
      return "parse_country";
    case "name":
    case "company_name":
    case "city":
      return "capitalize";
    default:
      return "trim";
  }
}

/** 3-tier key lookup: exact → normalized → fuzzy substring */
function findRowKey(row: Record<string, any>, targetKey: string): string | undefined {
  const keys = Object.keys(row);
  if (row[targetKey] !== undefined) return targetKey;

  const normTarget = normalizeKey(targetKey);
  const foundNorm = keys.find(k => normalizeKey(k) === normTarget);
  if (foundNorm) return foundNorm;

  const tLower = normTarget.replace(/_/g, "");
  return keys.find(k => {
    const kNorm = normalizeKey(k).replace(/_/g, "");
    return kNorm.length > 2 && tLower.length > 2 && (kNorm.includes(tLower) || tLower.includes(kNorm));
  });
}

function normalizeKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-\s]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

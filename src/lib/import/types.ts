/**
 * Import pipeline types — adapted from clever-contact-loader
 * Schema target: imported_contacts table
 */

export interface ParsedFile {
  headers: string[];
  rawHeaders: string[];           // Original headers before normalization
  rows: string[][];
  totalRows: number;
  sampleRows: string[][];
  detectedFormat: "csv" | "xlsx" | "xls" | "txt" | "json";
}

export interface ParsingOptions {
  delimiter: string;
  encoding: string;
  hasHeader: boolean;
  quoteChar: string;
  skipRows: number;
  selectedSheet?: string;
  sheets?: string[];
}

export interface ColumnMapping {
  sourceColumn: string;
  sourceIndex: number;
  targetColumn: string;           // key from TARGET_SCHEMA
  confidence: number;             // 0-100
  transformation: TransformationType;
}

export type TransformationType =
  | "none"
  | "trim"
  | "uppercase"
  | "lowercase"
  | "capitalize"
  | "normalize_phone"
  | "extract_email"
  | "parse_country"
  | "split_fullname";

export interface ValidationResult {
  validRows: Record<string, string | null>[];
  rejectedRows: RejectedRow[];
  stats: ImportStats;
}

export interface RejectedRow {
  rowIndex: number;
  originalData: string[];
  reasons: string[];
  mappedData?: Record<string, string | null>;
}

export interface ImportStats {
  totalRows: number;
  importedCount: number;
  rejectedCount: number;
}

/** Our target schema columns — matches imported_contacts table */
export const TARGET_COLUMNS = [
  "company_name", "name", "email", "phone", "mobile",
  "country", "city", "address", "zip_code", "position",
  "note", "origin", "external_id", "company_alias", "contact_alias",
] as const;

export type TargetColumnKey = typeof TARGET_COLUMNS[number];

export interface TargetColumn {
  key: TargetColumnKey;
  label: string;
  group: "azienda" | "contatto" | "indirizzo" | "altro";
  description?: string;
}

export const TARGET_SCHEMA: TargetColumn[] = [
  { key: "company_name", label: "Azienda", group: "azienda", description: "Ragione sociale" },
  { key: "company_alias", label: "Alias Azienda", group: "azienda", description: "Nome abbreviato" },
  { key: "name", label: "Nome Contatto", group: "contatto", description: "Nome e cognome" },
  { key: "contact_alias", label: "Alias Contatto", group: "contatto", description: "Nome informale" },
  { key: "position", label: "Ruolo", group: "contatto", description: "Posizione/ruolo aziendale" },
  { key: "email", label: "Email", group: "contatto", description: "Indirizzo email" },
  { key: "phone", label: "Telefono", group: "contatto", description: "Numero fisso" },
  { key: "mobile", label: "Cellulare", group: "contatto", description: "Numero mobile" },
  { key: "country", label: "Nazione", group: "indirizzo", description: "Paese" },
  { key: "city", label: "Città", group: "indirizzo", description: "Comune" },
  { key: "address", label: "Indirizzo", group: "indirizzo", description: "Via e civico" },
  { key: "zip_code", label: "CAP", group: "indirizzo", description: "Codice postale" },
  { key: "origin", label: "Origine", group: "altro", description: "Provenienza del contatto" },
  { key: "external_id", label: "ID Esterno", group: "altro", description: "Codice CRM esterno" },
  { key: "note", label: "Note", group: "altro", description: "Annotazioni" },
];

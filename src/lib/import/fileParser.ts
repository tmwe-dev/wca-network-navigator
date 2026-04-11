/**
 * Robust file parser — adapted from clever-contact-loader
 * Supports CSV, TXT, XLSX, XLS with auto-detection
 */
import Papa from "papaparse";
// ExcelJS loaded lazily to reduce bundle size (~940KB)
const getExcelJS = () => import("exceljs").then(m => m.default);
import type { ParsedFile, ParsingOptions } from "./types";
import { createLogger } from "@/lib/log";

const log = createLogger("fileParser");

const SAMPLE_SIZE = 50;

/** Auto-detect delimiter by consistency across first N lines */
function detectDelimiter(text: string): string {
  const lines = text.split("\n").slice(0, 10).filter(l => l.trim());
  const delimiters = [",", ";", "\t", "|"];
  const scores = delimiters.map(d => ({
    delimiter: d,
    count: lines.reduce((sum, line) => sum + (line.split(d).length - 1), 0),
    // Consistency = how uniform the column count is across lines
    consistency: new Set(lines.map(line => line.split(d).length)).size,
  }));
  // Lower consistency = more uniform = better
  scores.sort((a, b) => a.consistency - b.consistency || b.count - a.count);
  return scores[0]?.delimiter || ",";
}

/** Detect if first row is a header (text-heavy vs data rows) */
function detectHeader(rows: string[][]): boolean {
  if (rows.length < 2) return false;
  const first = rows[0];
  const rest = rows.slice(1, 6);
  const firstNonNumeric = first.filter(v => isNaN(Number(v)) && v.trim() !== "").length;
  const avgNonNumeric = rest.reduce((sum, row) =>
    sum + row.filter(v => isNaN(Number(v)) && v.trim() !== "").length, 0
  ) / rest.length;
  if (firstNonNumeric > avgNonNumeric + 1) return true;
  const textRatio = first.filter(v =>
    typeof v === "string" && v.match(/^[a-zA-ZÀ-ÿ_\s.]+$/)
  ).length / first.length;
  return textRatio > 0.6;
}

/** Generate auto headers: Colonna A, Colonna B, etc. */
function generateAutoHeaders(colCount: number): string[] {
  return Array.from({ length: colCount }, (_, i) => {
    const letter = String.fromCharCode(65 + (i % 26));
    const prefix = i >= 26 ? String.fromCharCode(65 + Math.floor(i / 26) - 1) : "";
    return `Colonna ${prefix}${letter}`;
  });
}

/** Uniform sample indices across the dataset */
function getSampleIndices(total: number, sampleSize: number): number[] {
  if (total <= sampleSize) return Array.from({ length: total }, (_, i) => i);
  const step = total / sampleSize;
  return Array.from({ length: sampleSize }, (_, i) =>
    Math.min(Math.floor(i * step), total - 1)
  );
}

/** Main entry: parse any supported file */
export async function parseFile(
  file: File,
  optionsOverride?: Partial<ParsingOptions>
): Promise<{ parsed: ParsedFile; options: ParsingOptions }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (ext === "json") {
    return parseJson(file, optionsOverride);
  }
  if (["xlsx", "xls"].includes(ext)) {
    return parseExcel(file, optionsOverride);
  }
  return parseCsvTxt(file, ext === "txt" ? "txt" : "csv", optionsOverride);
}

/** Parse CSV / TXT using PapaParse for robustness */
async function parseCsvTxt(
  file: File,
  format: "csv" | "txt",
  optionsOverride?: Partial<ParsingOptions>
): Promise<{ parsed: ParsedFile; options: ParsingOptions }> {
  const encoding = optionsOverride?.encoding || "utf-8";
  const text = await readFileAsText(file, encoding);
  const delimiter = optionsOverride?.delimiter || detectDelimiter(text);
  const quoteChar = optionsOverride?.quoteChar || '"';
  const skipRows = optionsOverride?.skipRows || 0;

  const result = Papa.parse<string[]>(text, {
    delimiter,
    quoteChar,
    skipEmptyLines: true,
    header: false,
  });

  let rows = (result.data as string[][]).slice(skipRows);
  if (rows.length === 0) throw new Error("Il file è vuoto o non contiene dati validi.");

  const hasHeader = optionsOverride?.hasHeader ?? detectHeader(rows);
  let rawHeaders: string[];
  let headers: string[];

  if (hasHeader) {
    rawHeaders = rows[0].map((h, i) => h?.trim() || `Colonna ${i + 1}`);
    headers = deduplicateHeaders(rawHeaders);
    rows = rows.slice(1);
  } else {
    rawHeaders = generateAutoHeaders(rows[0]?.length || 0);
    headers = [...rawHeaders];
  }

  // Normalize row lengths + filter empty
  const colCount = headers.length;
  rows = rows
    .map(row => {
      if (row.length < colCount) return [...row, ...Array(colCount - row.length).fill("")];
      if (row.length > colCount) return row.slice(0, colCount);
      return row;
    })
    .filter(row => row.some(cell => cell?.trim()));

  const sampleIndices = getSampleIndices(rows.length, SAMPLE_SIZE);
  const sampleRows = sampleIndices.map(i => rows[i]);

  const options: ParsingOptions = {
    delimiter,
    encoding,
    hasHeader,
    quoteChar,
    skipRows,
  };

  return {
    parsed: { headers, rawHeaders, rows, totalRows: rows.length, sampleRows, detectedFormat: format },
    options,
  };
}

/** Parse Excel using ExcelJS */
async function parseExcel(
  file: File,
  optionsOverride?: Partial<ParsingOptions>
): Promise<{ parsed: ParsedFile; options: ParsingOptions }> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheets = workbook.worksheets.map(ws => ws.name);
  const selectedSheet = optionsOverride?.selectedSheet || sheets[0];
  const sheet = workbook.worksheets.find(ws => ws.name === selectedSheet);
  if (!sheet) throw new Error(`Foglio "${selectedSheet}" non trovato.`);

  const skipRows = optionsOverride?.skipRows || 0;
  const allRows: string[][] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= skipRows) return;
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(String(cell.value ?? "").trim());
    });
    if (cells.some(c => c)) allRows.push(cells);
  });

  if (allRows.length === 0) throw new Error("Il foglio è vuoto.");

  const hasHeader = optionsOverride?.hasHeader ?? detectHeader(allRows);
  let rawHeaders: string[];
  let headers: string[];
  let rows: string[][];

  if (hasHeader) {
    rawHeaders = allRows[0].map((h, i) => h?.trim() || `Colonna ${i + 1}`);
    headers = deduplicateHeaders(rawHeaders);
    rows = allRows.slice(1);
  } else {
    rawHeaders = generateAutoHeaders(allRows[0]?.length || 0);
    headers = [...rawHeaders];
    rows = allRows;
  }

  // Normalize row lengths
  const colCount = headers.length;
  rows = rows.map(row => {
    if (row.length < colCount) return [...row, ...Array(colCount - row.length).fill("")];
    if (row.length > colCount) return row.slice(0, colCount);
    return row;
  });

  const sampleIndices = getSampleIndices(rows.length, SAMPLE_SIZE);
  const sampleRows = sampleIndices.map(i => rows[i]);

  const options: ParsingOptions = {
    delimiter: "",
    encoding: "binary",
    hasHeader,
    quoteChar: '"',
    skipRows,
    selectedSheet,
    sheets,
  };

  return {
    parsed: {
      headers,
      rawHeaders,
      rows,
      totalRows: rows.length,
      sampleRows,
      detectedFormat: file.name.endsWith(".xls") ? "xls" : "xlsx",
    },
    options,
  };
}

/** Parse JSON arrays/objects into the same tabular format used by the import wizard */
async function parseJson(
  file: File,
  optionsOverride?: Partial<ParsingOptions>
): Promise<{ parsed: ParsedFile; options: ParsingOptions }> {
  const encoding = optionsOverride?.encoding || "utf-8";
  const text = await readFileAsText(file, encoding);

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    throw new Error("Il file JSON non è valido.");
  }

  const records = extractJsonRecords(json);
  if (records.length === 0) {
    throw new Error("Il file JSON non contiene record importabili.");
  }

  const headers = deduplicateHeaders(Array.from(new Set(records.flatMap(record => Object.keys(record)))));
  const rows = records.map((record) => headers.map((header) => serializeJsonValue(record[header])));
  const sampleIndices = getSampleIndices(rows.length, SAMPLE_SIZE);
  const sampleRows = sampleIndices.map(i => rows[i]);

  const options: ParsingOptions = {
    delimiter: "",
    encoding,
    hasHeader: true,
    quoteChar: '"',
    skipRows: optionsOverride?.skipRows || 0,
  };

  return {
    parsed: {
      headers,
      rawHeaders: headers,
      rows,
      totalRows: rows.length,
      sampleRows,
      detectedFormat: "json",
    },
    options,
  };
}

function extractJsonRecords(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item));
  }

  if (json && typeof json === "object") {
    const objectEntries = Object.entries(json as Record<string, unknown>);
    for (const [, value] of objectEntries) {
      if (Array.isArray(value)) {
        const records = value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item));
        if (records.length > 0) return records;
      }
    }

    return [json as Record<string, unknown>];
  }

  return [];
}

function serializeJsonValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => serializeJsonValue(item))
      .filter(Boolean)
      .join(" | ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value).trim();
}

/** Deduplicate headers: "email", "email" → "email", "email_2" */
function deduplicateHeaders(headers: string[]): string[] {
  const counts: Record<string, number> = {};
  return headers.map(h => {
    const key = h.toLowerCase();
    if (!counts[key]) { counts[key] = 1; return h; }
    counts[key]++;
    return `${h}_${counts[key]}`;
  });
}

function readFileAsText(file: File, encoding: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Errore nella lettura del file."));
    reader.readAsText(file, encoding);
  });
}

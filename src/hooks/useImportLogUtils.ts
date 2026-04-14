/**
 * useImportLogs — Pure utility functions (no hooks/state)
 * Split from the original 619-LOC monolith.
 */
import type { ImportError } from "./useImportLogQueries";

export function exportErrorsToCSV(errors: ImportError[]) {
  const SEP = ";";
  const escapeCell = (val: unknown) => {
    if (val === null || val === undefined) return "";
    const s = String(val).replace(/"/g, '""');
    if (s.includes(SEP) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s}"`;
    }
    return s;
  };

  const firstWithRaw = errors.find(e => e.raw_data && typeof e.raw_data === "object");
  const rawKeys = firstWithRaw ? Object.keys(firstWithRaw.raw_data as Record<string, unknown>) : [];

  const headers = ["riga", "tipo_errore", "messaggio", ...rawKeys];
  const csvRows = [headers.map(escapeCell).join(SEP)];

  for (const err of errors) {
    const raw = (err.raw_data && typeof err.raw_data === "object" ? err.raw_data : {}) as Record<string, unknown>;
    const row = [
      escapeCell(err.row_number),
      escapeCell(err.error_type),
      escapeCell(err.error_message),
      ...rawKeys.map(k => escapeCell(raw[k])),
    ];
    csvRows.push(row.join(SEP));
  }

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvRows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `errori_import_${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

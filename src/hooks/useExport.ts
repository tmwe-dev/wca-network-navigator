/**
 * useExport — Hook for exporting contacts, partners, deals, and emails as CSV or Excel
 */
import { useMutation } from "@tanstack/react-query";
import {
  fetchContactsExportRows,
  fetchPartnersExportRows,
  fetchDealsExportRows,
  type ExportFilters,
} from "@/data/exports";


import { createLogger } from "@/lib/log";
const log = createLogger("useExport");
export type EntityType = "contacts" | "partners" | "deals" | "emails";
export type ExportFormat = "csv" | "xlsx";

export type { ExportFilters };

export interface ExportOptions {
  entity: EntityType;
  format: ExportFormat;
  filters?: ExportFilters;
  columns?: string[];
}

// ── CSV Builder ──

function escapeCSVField(field: unknown): string {
  const str = String(field ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function convertToCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const headerRow = headers.map(escapeCSVField).join(",");
  const dataRows = rows.map((row) => headers.map((h) => escapeCSVField(row[h])).join(","));
  return [headerRow, ...dataRows].join("\n");
}

// ── Excel Builder (ExcelJS — unica libreria fogli di calcolo del progetto) ──

async function convertToExcel(
  headers: string[],
  rows: Record<string, unknown>[],
  sheetName: string
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    // Dynamic import: ExcelJS resta fuori dal bundle iniziale.
    const ExcelJS = (await import("exceljs")).default;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName.slice(0, 31) || "Sheet1");
    worksheet.columns = headers.map((h) => ({ header: h, key: h, width: 20 }));
    for (const row of rows) {
      worksheet.addRow(
        headers.reduce<Record<string, unknown>>((acc, h) => {
          const v = row[h];
          acc[h] = v === null || v === undefined ? "" : (typeof v === "object" ? JSON.stringify(v) : v);
          return acc;
        }, {}),
      );
    }

    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    return new Uint8Array(buffer);
  } catch (error) {
    log.error("Excel export error:", { error: error });
    throw new Error("Esportazione Excel non disponibile. Usa CSV invece.");
  }
}

// ── Hooks ──

export function useExportCSV() {
  return useMutation({
    mutationFn: async (options: ExportOptions) => {
      let data: Record<string, unknown>[] = [];
      let defaultColumns: string[] = [];
      const filename = `export-${options.entity}`;

      switch (options.entity) {
        case "contacts":
          data = await fetchContactsExportRows(options.filters);
          defaultColumns = ["id", "name", "email", "phone", "mobile", "company_name", "position", "country", "created_at"];
          break;
        case "partners":
          data = await fetchPartnersExportRows(options.filters);
          defaultColumns = ["id", "company_name", "country_name", "website", "email", "phone", "lead_status", "created_at"];
          break;
        case "deals":
          data = await fetchDealsExportRows(options.filters);
          defaultColumns = ["id", "title", "stage", "amount", "probability", "expected_close_date", "created_at"];
          break;
        // TODO: Email export is disabled (dead code - see fetchEmailsData comment)
        // case "emails":
        //   data = await fetchEmailsData(options.filters);
        //   defaultColumns = ["id", "from_address", "to_address", "subject", "status", "created_at"];
        //   break;
      }

      const columns = options.columns || defaultColumns;
      const csv = convertToCSV(columns, data);

      // Trigger download
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);

      return { count: data.length, format: "csv" };
    },
  });
}

export function useExportExcel() {
  return useMutation({
    mutationFn: async (options: ExportOptions) => {
      let data: Record<string, unknown>[] = [];
      let defaultColumns: string[] = [];
      const filename = `export-${options.entity}`;

      switch (options.entity) {
        case "contacts":
          data = await fetchContactsExportRows(options.filters);
          defaultColumns = ["id", "name", "email", "phone", "mobile", "company_name", "position", "country", "created_at"];
          break;
        case "partners":
          data = await fetchPartnersExportRows(options.filters);
          defaultColumns = ["id", "company_name", "country_name", "website", "email", "phone", "lead_status", "created_at"];
          break;
        case "deals":
          data = await fetchDealsExportRows(options.filters);
          defaultColumns = ["id", "title", "stage", "amount", "probability", "expected_close_date", "created_at"];
          break;
        // TODO: Email export is disabled (dead code - see fetchEmailsData comment)
        // case "emails":
        //   data = await fetchEmailsData(options.filters);
        //   defaultColumns = ["id", "from_address", "to_address", "subject", "status", "created_at"];
        //   break;
      }

      const columns = options.columns || defaultColumns;
      const excelBuffer = await convertToExcel(columns, data, options.entity);

      // Trigger download
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}-${new Date().toISOString().split("T")[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);

      return { count: data.length, format: "xlsx" };
    },
  });
}

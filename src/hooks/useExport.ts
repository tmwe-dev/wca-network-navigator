/**
 * useExport — Hook for exporting contacts, partners, deals, and emails as CSV or Excel
 */
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type EntityType = "contacts" | "partners" | "deals" | "emails";
export type ExportFormat = "csv" | "xlsx";

export interface ExportFilters {
  dateRange?: {
    from: string;
    to: string;
  };
  status?: string | string[];
  tags?: string | string[];
  search?: string;
}

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

// ── Excel Builder (using xlsx if available) ──

async function convertToExcel(
  headers: string[],
  rows: Record<string, unknown>[],
  sheetName: string
): Promise<Uint8Array> {
  try {
    // Dynamic import to avoid bundling xlsx if not needed
    const XLSX = await import("xlsx");

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });

    // Set column widths
    const colWidths = headers.map(() => ({ wch: 20 }));
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as unknown as Uint8Array;
  } catch (error) {
    console.error("Excel export error:", error);
    throw new Error("Esportazione Excel non disponibile. Usa CSV invece.");
  }
}

// ── Export functions ──

async function fetchContactsData(filters?: ExportFilters): Promise<Record<string, unknown>[]> {
  let query = (supabase as any)
    .from("imported_contacts")
    .select(
      "id, name, email, phone, mobile, company_name, title, country, lead_status, created_at, interaction_count"
    );

  if (filters?.dateRange) {
    query = query
      .gte("created_at", filters.dateRange.from)
      .lte("created_at", filters.dateRange.to);
  }

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    query = query.in("lead_status", statuses);
  }

  if (filters?.search) {
    const term = `%${filters.search}%`;
    query = query.or(`name.ilike.${term},email.ilike.${term},company_name.ilike.${term}`);
  }

  const { data, error } = await query.limit(50000);
  if (error) throw error;
  return data || [];
}

async function fetchPartnersData(filters?: ExportFilters): Promise<Record<string, unknown>[]> {
  let query = (supabase as any)
    .from("partners")
    .select(
      "id, name, country, website, email, phone, registration_number, contact_person, status, created_at"
    );

  if (filters?.dateRange) {
    query = query
      .gte("created_at", filters.dateRange.from)
      .lte("created_at", filters.dateRange.to);
  }

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    query = query.in("status", statuses);
  }

  if (filters?.search) {
    const term = `%${filters.search}%`;
    query = query.or(`name.ilike.${term},email.ilike.${term},contact_person.ilike.${term}`);
  }

  const { data, error } = await query.limit(50000);
  if (error) throw error;
  return data || [];
}

async function fetchDealsData(filters?: ExportFilters): Promise<Record<string, unknown>[]> {
  let query = (supabase as any)
    .from("deals")
    .select(
      "id, title, partner_id, contact_id, stage, amount, probability, close_date, created_at, updated_at"
    );

  if (filters?.dateRange) {
    query = query
      .gte("created_at", filters.dateRange.from)
      .lte("created_at", filters.dateRange.to);
  }

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    query = query.in("stage", statuses);
  }

  const { data, error } = await query.limit(50000);
  if (error) throw error;
  return data || [];
}

async function fetchEmailsData(filters?: ExportFilters): Promise<Record<string, unknown>[]> {
  let query = (supabase as any)
    .from("emails")
    .select(
      "id, from_address, to_address, subject, created_at, message_id, contact_id, campaign_id, status"
    );

  if (filters?.dateRange) {
    query = query
      .gte("created_at", filters.dateRange.from)
      .lte("created_at", filters.dateRange.to);
  }

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    query = query.in("status", statuses);
  }

  if (filters?.search) {
    const term = `%${filters.search}%`;
    query = query.or(`subject.ilike.${term},from_address.ilike.${term},to_address.ilike.${term}`);
  }

  const { data, error } = await query.limit(50000);
  if (error) throw error;
  return data || [];
}

// ── Hooks ──

export function useExportCSV() {
  return useMutation({
    mutationFn: async (options: ExportOptions) => {
      let data: Record<string, unknown>[] = [];
      let defaultColumns: string[] = [];
      let filename = `export-${options.entity}`;

      switch (options.entity) {
        case "contacts":
          data = await fetchContactsData(options.filters);
          defaultColumns = ["id", "name", "email", "phone", "mobile", "company_name", "title", "country", "created_at"];
          break;
        case "partners":
          data = await fetchPartnersData(options.filters);
          defaultColumns = ["id", "name", "country", "website", "email", "phone", "status", "created_at"];
          break;
        case "deals":
          data = await fetchDealsData(options.filters);
          defaultColumns = ["id", "title", "stage", "amount", "probability", "close_date", "created_at"];
          break;
        case "emails":
          data = await fetchEmailsData(options.filters);
          defaultColumns = ["id", "from_address", "to_address", "subject", "status", "created_at"];
          break;
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
      let filename = `export-${options.entity}`;

      switch (options.entity) {
        case "contacts":
          data = await fetchContactsData(options.filters);
          defaultColumns = ["id", "name", "email", "phone", "mobile", "company_name", "title", "country", "created_at"];
          break;
        case "partners":
          data = await fetchPartnersData(options.filters);
          defaultColumns = ["id", "name", "country", "website", "email", "phone", "status", "created_at"];
          break;
        case "deals":
          data = await fetchDealsData(options.filters);
          defaultColumns = ["id", "title", "stage", "amount", "probability", "close_date", "created_at"];
          break;
        case "emails":
          data = await fetchEmailsData(options.filters);
          defaultColumns = ["id", "from_address", "to_address", "subject", "status", "created_at"];
          break;
      }

      const columns = options.columns || defaultColumns;
      const excelBuffer = await convertToExcel(columns, data, options.entity);

      // Trigger download
      const blob = new Blob([excelBuffer as unknown as BlobPart], {
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

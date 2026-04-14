/**
 * useImportV2 — CSV import wizard logic
 */
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface ImportColumn {
  readonly csvHeader: string;
  readonly mappedTo: string | null;
}

export interface ImportPreviewRow {
  readonly [key: string]: string;
}

const TARGET_FIELDS = [
  "company_name", "name", "email", "phone", "mobile",
  "position", "city", "country", "address", "zip_code",
  "origin", "note", "company_alias", "contact_alias",
] as const;

export type TargetField = typeof TARGET_FIELDS[number];

export function useImportV2() {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<ImportPreviewRow[]>([]);
  const [columns, setColumns] = useState<ImportColumn[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null);

  const parseCSV = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      if (lines.length < 2) return;

      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const rows: ImportPreviewRow[] = [];
      for (let i = 1; i < Math.min(lines.length, 101); i++) {
        const vals = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });
        rows.push(row);
      }
      setRawRows(rows);
      setColumns(headers.map((h) => ({
        csvHeader: h,
        mappedTo: autoMap(h),
      })));
      setStep(2);
    };
    reader.readAsText(file);
  }, []);

  const updateMapping = useCallback((csvHeader: string, mappedTo: string | null) => {
    setColumns((prev) =>
      prev.map((c) => c.csvHeader === csvHeader ? { ...c, mappedTo } : c),
    );
  }, []);

  const executeImport = useCallback(async () => {
    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create import log
      const { data: log, error: logErr } = await supabase
        .from("import_logs")
        .insert({
          user_id: user.id,
          file_name: fileName,
          total_rows: rawRows.length,
          status: "processing",
          normalization_method: "manual_csv",
        })
        .select("id")
        .single();
      if (logErr || !log) throw logErr || new Error("Failed to create import log");

      const mappedCols = columns.filter((c) => c.mappedTo);
      let imported = 0;
      let errors = 0;

      // Batch insert 50 at a time
      for (let i = 0; i < rawRows.length; i += 50) {
        const batch = rawRows.slice(i, i + 50).map((row, idx) => {
          const record: Record<string, unknown> = {
            import_log_id: log.id,
            user_id: user.id,
            row_number: i + idx + 1,
          };
          mappedCols.forEach((col) => {
            if (col.mappedTo) record[col.mappedTo] = row[col.csvHeader] || null;
          });
          return record;
        });

        const typedBatch = batch as Array<{
          import_log_id: string;
          user_id: string;
          row_number: number;
          [key: string]: unknown;
        }>;
        const { error: insertErr } = await supabase
          .from("imported_contacts")
          .insert(typedBatch as never);
        if (insertErr) { errors += batch.length; } else { imported += batch.length; }
      }

      // Update log
      await supabase
        .from("import_logs")
        .update({ status: "completed", imported_rows: imported, error_rows: errors, completed_at: new Date().toISOString() })
        .eq("id", log.id);

      setResult({ imported, errors });
      setStep(4);
      qc.invalidateQueries({ queryKey: queryKeys.v2.contacts() });
    } finally {
      setImporting(false);
    }
  }, [columns, fileName, rawRows, qc]);

  return {
    step, setStep, fileName, rawRows, columns, importing, result,
    parseCSV, updateMapping, executeImport, targetFields: TARGET_FIELDS,
  } as const;
}

function autoMap(header: string): string | null {
  const h = header.toLowerCase().replace(/[_\-\s]/g, "");
  const map: Record<string, string> = {
    companyname: "company_name", company: "company_name", azienda: "company_name",
    name: "name", nome: "name", contactname: "name",
    email: "email", mail: "email", emailaddress: "email",
    phone: "phone", telefono: "phone", tel: "phone",
    mobile: "mobile", cellulare: "mobile", cell: "mobile",
    position: "position", posizione: "position", role: "position", ruolo: "position",
    city: "city", citta: "city", città: "city",
    country: "country", paese: "country", nazione: "country",
    address: "address", indirizzo: "address",
    zipcode: "zip_code", cap: "zip_code", zip: "zip_code",
    origin: "origin", fonte: "origin", source: "origin",
    note: "note", notes: "note",
  };
  return map[h] ?? null;
}

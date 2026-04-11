/**
 * useImportLogsV2 — fetch import history
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ImportLog {
  readonly id: string;
  readonly fileName: string;
  readonly totalRows: number;
  readonly importedRows: number;
  readonly errorRows: number;
  readonly status: string;
  readonly createdAt: string;
}

export function useImportLogsV2() {
  return useQuery({
    queryKey: ["v2-import-logs"],
    queryFn: async (): Promise<readonly ImportLog[]> => {
      const { data, error } = await supabase
        .from("import_logs")
        .select("id, file_name, total_rows, imported_rows, error_rows, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        fileName: r.file_name,
        totalRows: r.total_rows,
        importedRows: r.imported_rows,
        errorRows: r.error_rows,
        status: r.status,
        createdAt: r.created_at,
      }));
    },
  });
}

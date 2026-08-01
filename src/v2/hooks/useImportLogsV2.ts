/**
 * useImportLogsV2 — fetch import history
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { findImportLogsList } from "@/data/importLogsListV2";

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
    queryKey: queryKeys.v2.importLogs,
    queryFn: async (): Promise<readonly ImportLog[]> => {
      const data = await findImportLogsList(50);
      return data.map((r) => ({
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

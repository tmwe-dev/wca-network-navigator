import { useQuery } from "@tanstack/react-query";
import { findImportGroups } from "@/data/importLogs";
import { queryKeys } from "@/lib/queryKeys";

export interface ImportGroup {
  id: string;
  group_name: string;
  file_name: string;
  created_at: string;
  imported_rows: number;
  status: string;
}

export function useImportGroups() {
  return useQuery({
    queryKey: queryKeys.imports.groups,
    queryFn: async () => {
      const data = await findImportGroups();
      return (data ?? []).map((d) => ({
        ...d,
        group_name: d.group_name || d.file_name?.replace(/\.(csv|xlsx|xls)$/i, "") || "Senza nome",
      })) as ImportGroup[];
    },
  });
}

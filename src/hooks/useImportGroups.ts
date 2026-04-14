import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
      const { data, error } = await supabase
        .from("import_logs")
        .select("id, group_name, file_name, created_at, imported_rows, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((d) => ({
        ...d,
        group_name: d.group_name || d.file_name?.replace(/\.(csv|xlsx|xls)$/i, "") || "Senza nome",
      })) as ImportGroup[];
    },
  });
}

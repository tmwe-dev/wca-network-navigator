import { useQuery } from "@tanstack/react-query";
import { findAllProspects } from "@/data/prospects";
import type { Database } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

type ProspectRow = Database["public"]["Tables"]["prospects"]["Row"];

export type Prospect = ProspectRow;

export function useProspects() {
  return useQuery({
    queryKey: queryKeys.prospects.all,
    queryFn: async () => {
      return await findAllProspects();
    },
  });
}

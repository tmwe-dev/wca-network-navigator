import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProspectRow = Database["public"]["Tables"]["prospects"]["Row"];

export type Prospect = ProspectRow;

export function useProspects() {
  return useQuery({
    queryKey: ["prospects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .order("company_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

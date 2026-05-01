/**
 * useAnagraphicsCounts — total counts for the 3 anagraphics
 * (WCA Partners, Business Cards, CRM Contacts) shown as pills in the top bar.
 *
 * Cached 5 min, 3 parallel HEAD count queries.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AnagraphicsCounts {
  readonly partners: number;
  readonly businessCards: number;
  readonly contacts: number;
}

export function useAnagraphicsCounts() {
  return useQuery({
    queryKey: ["anagraphics-counts"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AnagraphicsCounts> => {
      const [p, b, c] = await Promise.all([
        supabase.from("partners").select("id", { count: "exact", head: true }),
        supabase.from("business_cards").select("id", { count: "exact", head: true }),
        supabase.from("imported_contacts").select("id", { count: "exact", head: true }),
      ]);
      return {
        partners: p.count ?? 0,
        businessCards: b.count ?? 0,
        contacts: c.count ?? 0,
      };
    },
  });
}
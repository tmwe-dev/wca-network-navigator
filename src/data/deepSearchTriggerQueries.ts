/** DAL — Queries for useDeepSearchTrigger. */
import { supabase } from "@/integrations/supabase/client";

export async function getPartnerEnrichmentDataForDeepSearch(partnerId: string): Promise<Record<string, unknown> | null | undefined> {
  const { data } = await supabase.from("partners").select("enrichment_data").eq("id", partnerId).maybeSingle();
  return data?.enrichment_data as Record<string, unknown> | null | undefined;
}

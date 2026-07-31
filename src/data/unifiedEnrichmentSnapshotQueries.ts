/** DAL — Queries for useUnifiedEnrichmentSnapshot. */
import { supabase } from "@/integrations/supabase/client";

export async function getPartnerEnrichmentData(partnerId: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabase.from("partners").select("enrichment_data").eq("id", partnerId).maybeSingle();
  return ((data as { enrichment_data?: Record<string, unknown> } | null)?.enrichment_data ?? null);
}

export interface SherlockLatestRow {
  created_at: string;
  level: string | number | null;
}

export async function getLatestCompletedSherlockInvestigation(partnerId: string): Promise<SherlockLatestRow | null> {
  const { data } = await supabase
    .from("sherlock_investigations")
    .select("created_at, level")
    .eq("partner_id", partnerId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as SherlockLatestRow | null) ?? null;
}

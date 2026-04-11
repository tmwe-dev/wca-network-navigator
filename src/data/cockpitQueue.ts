/**
 * DAL — cockpit_queue
 */
import { supabase } from "@/integrations/supabase/client";

export async function insertCockpitQueueItems(items: Array<{ user_id: string; source_type: string; source_id: string; partner_id?: string | null }>) {
  const { error } = await supabase.from("cockpit_queue").upsert(items as any, { onConflict: "user_id,source_type,source_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function deleteCockpitQueueItem(id: string) {
  const { error } = await supabase.from("cockpit_queue").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteCockpitQueueBySource(userId: string, sourceType: string, sourceId: string) {
  const { error } = await supabase.from("cockpit_queue").delete().eq("user_id", userId).eq("source_type", sourceType).eq("source_id", sourceId);
  if (error) throw error;
}

export async function findCockpitQueue(userId: string, status = "queued", limit = 500) {
  const { data, error } = await supabase
    .from("cockpit_queue")
    .select("*")
    .eq("user_id", userId)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/**
 * DAL — cockpit_queue
 */
import { supabase } from "@/integrations/supabase/client";
import { emitBusyPartnersChanged } from "@/v2/hooks/useBusyPartners";

export async function insertCockpitQueueItems(items: Array<{ user_id: string; source_type: string; source_id: string; partner_id?: string | null }>) {
  const { error } = await supabase.from("cockpit_queue").upsert(items as never, { onConflict: "user_id,source_type,source_id", ignoreDuplicates: true });
  if (error) throw error;
  emitBusyPartnersChanged();
}

export async function deleteCockpitQueueItem(id: string) {
  const { error } = await supabase.from("cockpit_queue").delete().eq("id", id);
  if (error) throw error;
  emitBusyPartnersChanged();
}

export async function deleteCockpitQueueBySource(userId: string, sourceType: string, sourceId: string) {
  // Visibilità interna globale: il Cockpit mostra anche record di altri operatori,
  // quindi la cancellazione non filtra per user_id (la RLS DELETE è già aperta agli autenticati).
  // userId resta nella firma per compatibilità con i call site esistenti.
  void userId;
  const { error, count } = await supabase
    .from("cockpit_queue")
    .delete({ count: "exact" })
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);
  if (error) throw error;
  emitBusyPartnersChanged();
  return count ?? 0;
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

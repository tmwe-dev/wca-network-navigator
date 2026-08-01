/**
 * DAL — scraper_agent_memory: azioni amministrative (forza rinnovo piano, reset memoria).
 */
import { supabase } from "@/integrations/supabase/client";

/** Marca il piano corrente come scaduto (forza rigenerazione al prossimo ciclo). */
export async function invalidateOptimusMemoryPlan(channel: string, pageType: string): Promise<void> {
  const { error } = await supabase
    .from("scraper_agent_memory")
    .update({ consecutive_failures: 99, dom_structure_hash: null })
    .eq("channel", channel)
    .eq("page_type", pageType);
  if (error) throw error;
}

/** Elimina completamente la memoria per (channel, pageType). */
export async function deleteOptimusMemory(channel: string, pageType: string): Promise<void> {
  const { error } = await supabase
    .from("scraper_agent_memory")
    .delete()
    .eq("channel", channel)
    .eq("page_type", pageType);
  if (error) throw error;
}

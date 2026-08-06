/**
 * DAL — download_queue (Operations center).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DownloadQueueRow = Database["public"]["Tables"]["download_queue"]["Row"];

export async function findDownloadQueueItems(): Promise<DownloadQueueRow[]> {
  const { data, error } = await supabase.from("download_queue").select("*").order("priority", { ascending: false });
  if (error) return [];
  return data ?? [];
}

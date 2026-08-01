/** DAL — Queries for useAlertConfig. */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AlertConfigInsert = Database["public"]["Tables"]["alert_config"]["Insert"];

type AlertConfigRow = Database["public"]["Tables"]["alert_config"]["Row"];

export async function getAlertConfig(): Promise<AlertConfigRow | null> {
  const { data } = await supabase.from("alert_config").select("*").maybeSingle();
  return data as AlertConfigRow | null;
}

export async function upsertAlertConfig(row: AlertConfigInsert): Promise<AlertConfigRow> {
  const { data, error } = await supabase.from("alert_config").upsert(row).select().single();
  if (error) throw error;
  return data as AlertConfigRow;
}

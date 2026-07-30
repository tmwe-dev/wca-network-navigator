/**
 * DAL — network_configs (configurazione network partner).
 */
import { supabase } from "@/integrations/supabase/client";

export interface NetworkConfigRow {
  id: string;
  network_name: string;
  is_member: boolean;
  has_contact_emails: boolean;
  has_contact_names: boolean;
  has_contact_phones: boolean;
  sample_tested_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function findNetworkConfigs(): Promise<NetworkConfigRow[]> {
  const { data, error } = await supabase
    .from("network_configs")
    .select("*")
    .order("network_name");
  if (error) throw error;
  return (data ?? []) as NetworkConfigRow[];
}

export async function updateNetworkConfig(
  config: Partial<NetworkConfigRow> & { id: string },
): Promise<void> {
  const { error } = await supabase.from("network_configs").update(config).eq("id", config.id);
  if (error) throw error;
}

export async function insertNetworkConfig(networkName: string): Promise<void> {
  const { error } = await supabase
    .from("network_configs")
    .insert({ network_name: networkName, is_member: true });
  if (error) throw error;
}
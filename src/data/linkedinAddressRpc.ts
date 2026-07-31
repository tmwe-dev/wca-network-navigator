/**
 * DAL — RPC wrapper for upsert_linkedin_address (used by useLinkedInSync).
 */
import { supabase } from "@/integrations/supabase/client";

export interface UpsertLinkedInAddressParams {
  p_user_id: string;
  p_operator_id: string;
  p_profile_slug: string;
  p_profile_url: string | null;
  p_display_name: string;
  p_headline: string | null;
  p_direction: "inbound" | "outbound";
  p_message_at: string;
}

export async function upsertLinkedInAddress(params: UpsertLinkedInAddressParams): Promise<void> {
  const { error } = await supabase.rpc("upsert_linkedin_address" as never, params as never);
  if (error) throw error;
}

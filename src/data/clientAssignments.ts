/**
 * DAL — client_assignments
 */
import { supabase } from "@/integrations/supabase/client";

export async function findClientAssignmentsByUser(userId: string, select = "agent_id") {
  const { data, error } = await supabase.from("client_assignments").select(select).eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

/**
 * DAL — profiles
 */
import { supabase } from "@/integrations/supabase/client";

export async function checkProfileConnection() {
  const { error } = await supabase.from("profiles").select("id").limit(1);
  return { error };
}

export async function getProfileSummary() {
  const { data, error } = await supabase.from("profiles").select("id, display_name, onboarding_completed").limit(1).single();
  if (error) throw error;
  return data;
}

export async function updateProfileOnboarding(userId: string) {
  const { error } = await supabase.from("profiles").update({ onboarding_completed: true }).eq("user_id", userId);
  if (error) throw error;
}

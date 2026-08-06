/**
 * DAL — profile + ruoli utente per useAuthV2.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface AuthProfileRow {
  readonly id: string;
  readonly display_name: string | null;
  readonly user_id: string;
}

export async function fetchAuthProfile(userId: string): Promise<AuthProfileRow | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

export async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!data || data.length === 0) return ["user" as AppRole];
  return data.map((row) => row.role);
}

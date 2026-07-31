/**
 * DAL — authorized_users ordinati per created_at desc (Admin Users V2).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AuthorizedUserFullRow = Database["public"]["Tables"]["authorized_users"]["Row"];

export async function findAuthorizedUsersDesc(): Promise<AuthorizedUserFullRow[]> {
  const { data, error } = await supabase
    .from("authorized_users")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

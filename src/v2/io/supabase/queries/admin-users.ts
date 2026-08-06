/**
 * IO Queries: Admin Authorized Users
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";

export type AuthorizedUserRow = Database["public"]["Tables"]["authorized_users"]["Row"];

export async function fetchAuthorizedUsersRaw(): Promise<{
  data: AuthorizedUserRow[] | null;
  error: PostgrestError | null;
}> {
  return supabase.from("authorized_users").select("*").order("created_at", { ascending: false });
}

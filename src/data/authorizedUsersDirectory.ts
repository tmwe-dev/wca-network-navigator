/**
 * DAL — authorized_users, proiezione ridotta per picker (id, email, display_name).
 */
import { supabase } from "@/integrations/supabase/client";

export interface AuthorizedUserDirectoryRow {
  id: string;
  email: string;
  display_name: string | null;
}

/** Elenco utenti autorizzati ordinato per email, proiezione ridotta. */
export async function findAuthorizedUsersDirectory(): Promise<AuthorizedUserDirectoryRow[]> {
  const { data, error } = await supabase
    .from("authorized_users")
    .select("id, email, display_name")
    .order("email");
  if (error) throw error;
  return data ?? [];
}

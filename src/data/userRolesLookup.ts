/**
 * DAL — user_roles con join su roles(id, name), per un elenco di utenti.
 */
import { supabase } from "@/integrations/supabase/client";

export interface UserRoleJoinRow {
  user_id: string;
  roles: { id: string; name: string } | null;
}

/** Ruoli assegnati per un set di user_id. */
export async function findUserRolesForUsers(userIds: string[]): Promise<UserRoleJoinRow[]> {
  if (!userIds.length) return [];
  const { data, error } = (await supabase
    .from("user_roles")
    .select("user_id, roles(id, name)")
    .in("user_id", userIds)) as unknown as { data: UserRoleJoinRow[] | null; error: unknown };
  if (error) throw error;
  return (data as UserRoleJoinRow[]) ?? [];
}

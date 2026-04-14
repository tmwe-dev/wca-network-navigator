/**
 * useAdminUsersV2 — Authorized users management
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

interface AuthorizedUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly isActive: boolean;
  readonly loginCount: number;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
}

export function useAdminUsersV2() {
  return useQuery({
    queryKey: queryKeys.v2.authorizedUsers,
    queryFn: async (): Promise<readonly AuthorizedUser[]> => {
      const { data, error } = await supabase
        .from("authorized_users")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []).map((r) => ({
        id: r.id,
        email: r.email,
        displayName: r.display_name,
        isActive: r.is_active,
        loginCount: r.login_count,
        lastLoginAt: r.last_login_at,
        createdAt: r.created_at,
      }));
    },
  });
}

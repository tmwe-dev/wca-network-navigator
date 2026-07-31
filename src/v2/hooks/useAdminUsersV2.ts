/**
 * useAdminUsersV2 — Authorized users management
 */
import { useQuery } from "@tanstack/react-query";
import { fetchAuthorizedUsersRaw } from "@/v2/io/supabase/queries/admin-users";
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
      const { data, error } = await fetchAuthorizedUsersRaw();
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

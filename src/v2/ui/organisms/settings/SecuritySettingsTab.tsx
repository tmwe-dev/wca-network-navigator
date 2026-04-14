/**
 * SecuritySettingsTab — Authorized users management
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "../../atoms/StatusBadge";
import { queryKeys } from "@/lib/queryKeys";

export function SecuritySettingsTab(): React.ReactElement {
  const { data: users, isLoading } = useQuery({
    queryKey: queryKeys.v2.authorizedUsers,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("authorized_users")
        .select("id, email, display_name, is_active, last_login_at, login_count")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Utenti autorizzati</h3>
      <p className="text-sm text-muted-foreground">Solo gli utenti in questa lista possono accedere alla piattaforma.</p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Stato</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Login</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-2 text-foreground">{u.email}</td>
                  <td className="px-4 py-2 text-foreground">{u.display_name ?? "—"}</td>
                  <td className="px-4 py-2">
                    <StatusBadge
                      status={u.is_active ? "success" : "error"}
                      label={u.is_active ? "Attivo" : "Disattivato"}
                    />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{u.login_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

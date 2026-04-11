/**
 * AdminUsersPage — Authorized users management
 */
import * as React from "react";
import { useAdminUsersV2 } from "@/v2/hooks/useAdminUsersV2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, UserCheck, UserX } from "lucide-react";

export function AdminUsersPage(): React.ReactElement {
  const { data: users } = useAdminUsersV2();

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-5 w-5" /> Gestione Utenti
        </h1>
        <p className="text-xs text-muted-foreground">{users?.length ?? 0} utenti autorizzati</p>
      </div>

      <Card className="flex-1">
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="divide-y">
              {(users ?? []).map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-sm">{user.displayName ?? user.email}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">Login: {user.loginCount} • Ultimo: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Mai"}</p>
                  </div>
                  <Badge variant={user.isActive ? "default" : "secondary"} className="flex items-center gap-1">
                    {user.isActive ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                    {user.isActive ? "Attivo" : "Disattivato"}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

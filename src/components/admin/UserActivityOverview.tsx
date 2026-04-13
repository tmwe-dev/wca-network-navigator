/**
 * UserActivityOverview — Admin dashboard showing all users' activity stats.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Mail, Bot, Activity, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { RoleGuard } from "@/components/auth/RoleGuard";

interface UserStat {
  userId: string;
  email: string;
  displayName: string | null;
  roles: string[];
  partnersCount: number;
  contactsCount: number;
  emailsSentToday: number;
  agentsCount: number;
  lastActive: string | null;
}

function useUserStats() {
  return useQuery({
    queryKey: ["admin-user-stats"],
    queryFn: async (): Promise<UserStat[]> => {
      // Get all authorized users
      const { data: users } = await supabase
        .from("authorized_users")
        .select("email, display_name, last_login_at")
        .eq("is_active", true);

      if (!users) return [];

      // Get profiles to map emails to user_ids
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name");

      if (!profiles) return [];

      // Get roles
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const roleMap = new Map<string, string[]>();
      roleData?.forEach((r) => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      });

      const today = new Date().toISOString().split("T")[0];

      const stats: UserStat[] = [];
      for (const profile of profiles) {
        const user = users.find(
          (u) => u.display_name === profile.display_name || u.email
        );

        // Count activities sent today
        const { count: emailsToday } = await supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("user_id", profile.user_id)
          .eq("activity_type", "send_email")
          .gte("created_at", today);

        // Count agents
        const { count: agentsCount } = await supabase
          .from("agents")
          .select("id", { count: "exact", head: true })
          .eq("user_id", profile.user_id);

        stats.push({
          userId: profile.user_id,
          email: user?.email || "—",
          displayName: profile.display_name,
          roles: roleMap.get(profile.user_id) || ["user"],
          partnersCount: 0,
          contactsCount: 0,
          emailsSentToday: emailsToday ?? 0,
          agentsCount: agentsCount ?? 0,
          lastActive: user?.last_login_at || null,
        });
      }

      return stats;
    },
    refetchInterval: 60_000,
  });
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-destructive/15 text-destructive border-destructive/30",
    moderator: "bg-primary/15 text-primary border-primary/30",
    user: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={`text-[9px] ${colors[role] || colors.user}`}>
      {role}
    </Badge>
  );
}

function UserActivityOverviewContent() {
  const { data: users, isLoading } = useUserStats();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Panoramica Utenti</h2>
        <Badge variant="outline" className="text-xs">{users?.length ?? 0} utenti</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <Card className="bg-card/50 backdrop-blur-sm">
          <CardContent className="p-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <div>
              <p className="text-[10px] text-muted-foreground">Utenti Totali</p>
              <p className="text-lg font-bold">{users?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm">
          <CardContent className="p-3 flex items-center gap-2">
            <Mail className="w-4 h-4 text-emerald-500" />
            <div>
              <p className="text-[10px] text-muted-foreground">Email Oggi</p>
              <p className="text-lg font-bold">{users?.reduce((s, u) => s + u.emailsSentToday, 0) ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm">
          <CardContent className="p-3 flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            <div>
              <p className="text-[10px] text-muted-foreground">Agenti Totali</p>
              <p className="text-lg font-bold">{users?.reduce((s, u) => s + u.agentsCount, 0) ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm">
          <CardContent className="p-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-500" />
            <div>
              <p className="text-[10px] text-muted-foreground">Admin</p>
              <p className="text-lg font-bold">{users?.filter(u => u.roles.includes("admin")).length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <ScrollArea className="h-[calc(100vh-320px)]">
        <div className="space-y-2">
          {users?.map((user) => (
            <Card key={user.userId} className="bg-card/30 backdrop-blur-sm border-border/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {(user.displayName || user.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.displayName || user.email}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="flex gap-1">
                      {user.roles.map((r) => <RoleBadge key={r} role={r} />)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {user.emailsSentToday} oggi
                    </span>
                    <span className="flex items-center gap-1">
                      <Bot className="w-3 h-3" /> {user.agentsCount}
                    </span>
                    {user.lastActive && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(user.lastActive), { addSuffix: true, locale: it })}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function UserActivityOverview() {
  return (
    <RoleGuard requiredRole="admin">
      <UserActivityOverviewContent />
    </RoleGuard>
  );
}

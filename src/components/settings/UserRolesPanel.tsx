/**
 * User Roles Panel
 * Assign and manage roles for users
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoles, useAssignUserRole, useRemoveUserRole, type Role } from "@/hooks/useRBAC";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

interface UserWithRoles {
  id: string;
  email: string;
  display_name: string | null;
  roles: { id: string; name: string }[];
}

interface UserRoleJoin {
  user_id: string;
  roles: { id: string; name: string } | null;
}

export default function UserRolesPanel() {
  const qc = useQueryClient();
  const { data: rolesData } = useRoles();
  const roles: Role[] = rolesData || [];
  const assignRoleMut = useAssignUserRole();
  const removeRoleMut = useRemoveUserRole();

  const [searchTerm, setSearchTerm] = useState("");
  const [addRoleDialogOpen, setAddRoleDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  // Fetch authorized users
  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["authorized-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("authorized_users")
        .select("id, email, display_name")
        .order("email");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch user roles
  const { data: userRolesMap = {}, isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles-all"],
    queryFn: async () => {
      if (!allUsers.length) return {};
      const { data, error } = (await supabase
        .from("user_roles")
        .select("user_id, roles(id, name)")
        .in(
          "user_id",
          allUsers.map((u) => u.id),
        )) as unknown as { data: UserRoleJoin[] | null; error: unknown };
      if (error) throw error;

      const map: Record<string, { id: string; name: string }[]> = {};
      (data as UserRoleJoin[] || []).forEach((ur) => {
        if (!map[ur.user_id]) map[ur.user_id] = [];
        if (ur.roles) map[ur.user_id].push(ur.roles);
      });
      return map;
    },
    enabled: allUsers.length > 0,
  });

  // Filter users by search
  const filteredUsers = allUsers.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  const usersWithRoles: UserWithRoles[] = filteredUsers.map((u) => ({
    ...u,
    roles: userRolesMap[u.id] || [],
  }));

  const handleAssignRole = async () => {
    if (!selectedUserId || !selectedRoleId) {
      toast.error("Seleziona un utente e un ruolo");
      return;
    }

    try {
      await assignRoleMut.mutateAsync({ userId: selectedUserId, roleId: selectedRoleId });
      toast.success("Ruolo assegnato con successo");
      setAddRoleDialogOpen(false);
      setSelectedRoleId("");
      qc.invalidateQueries({ queryKey: ["user-roles-all"] });
    } catch (err) {
      toast.error(`Errore: ${err instanceof Error ? err.message : "Impossibile assegnare il ruolo"}`);
    }
  };

  const handleRemoveRole = async (userId: string, roleId: string) => {
    if (!window.confirm("Sei sicuro di voler rimuovere questo ruolo?")) {
      return;
    }

    try {
      await removeRoleMut.mutateAsync({ userId, roleId });
      toast.success("Ruolo rimosso con successo");
      qc.invalidateQueries({ queryKey: ["user-roles-all"] });
    } catch (err) {
      toast.error(`Errore: ${err instanceof Error ? err.message : "Impossibile rimuovere il ruolo"}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gestione Ruoli Utenti</h3>
          <p className="text-sm text-muted-foreground">Assegna ruoli agli utenti del sistema</p>
        </div>
        <Button onClick={() => setAddRoleDialogOpen(true)} disabled={usersLoading || rolesLoading}>
          <Plus className="h-4 w-4 mr-2" />
          Assegna Ruolo
        </Button>
      </div>

      {/* Search Box */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per email o nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Add Role Dialog */}
      <Dialog open={addRoleDialogOpen} onOpenChange={setAddRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assegna Ruolo a Utente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Utente</label>
              <Select value={selectedUserId || ""} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona utente..." />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.display_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Ruolo</label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona ruolo..." />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRoleDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleAssignRole} disabled={assignRoleMut.isPending}>
              {assignRoleMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Assegna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Utenti e Ruoli</CardTitle>
          <CardDescription>Visualizza e gestisci i ruoli assegnati a ciascun utente</CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading || rolesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Ruoli</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersWithRoles.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.display_name || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {user.roles.length === 0 ? (
                            <Badge variant="outline">Nessun ruolo</Badge>
                          ) : (
                            user.roles.map((role) => (
                              <Badge key={role.id} variant="secondary">
                                {role.name}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {user.roles.map((role) => (
                          <Button
                            key={role.id}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRole(user.id, role.id)}
                            className="mr-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

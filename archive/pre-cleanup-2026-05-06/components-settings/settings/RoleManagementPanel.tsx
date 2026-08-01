/**
 * Role Management Panel
 * Manage roles, permissions, and role-permission assignments
 */
import { useState } from "react";
import { useRoles, usePermissions, useRolePermissions, useAssignPermission, useRemovePermission, useCreateRole, useUpdateRole, useDeleteRole } from "@/hooks/useRBAC";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RoleManagementPanel() {
  const { data: roles = [], isLoading: rolesLoading } = useRoles();
  const { data: permissions = [], isLoading: permLoading } = usePermissions();
  const createRoleMut = useCreateRole();
  const updateRoleMut = useUpdateRole();
  const deleteRoleMut = useDeleteRole();
  const assignPermMut = useAssignPermission();
  const removePermMut = useRemovePermission();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<string | null>(null);

  const { data: rolePerms = [], isLoading: rolePermsLoading } = useRolePermissions(selectedRoleForPerms ?? "");

  const rolePermIds = new Set(rolePerms.map((p) => p.id));

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      toast.error("Il nome del ruolo è obbligatorio");
      return;
    }

    try {
      await createRoleMut.mutateAsync({
        name: newRoleName,
        description: newRoleDesc || undefined,
        isSystem: false,
      });
      toast.success("Ruolo creato con successo");
      setNewRoleName("");
      setNewRoleDesc("");
      setCreateDialogOpen(false);
    } catch (err) {
      toast.error(`Errore: ${err instanceof Error ? err.message : "Impossibile creare il ruolo"}`);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    if (role?.is_system) {
      toast.error("Non puoi eliminare un ruolo di sistema");
      return;
    }

    if (!window.confirm(`Sei sicuro di voler eliminare il ruolo "${role?.name}"?`)) {
      return;
    }

    try {
      await deleteRoleMut.mutateAsync(roleId);
      toast.success("Ruolo eliminato con successo");
    } catch (err) {
      toast.error(`Errore: ${err instanceof Error ? err.message : "Impossibile eliminare il ruolo"}`);
    }
  };

  const handleTogglePermission = async (roleId: string, permissionId: string) => {
    try {
      if (rolePermIds.has(permissionId)) {
        await removePermMut.mutateAsync({ roleId, permissionId });
        toast.success("Permesso rimosso");
      } else {
        await assignPermMut.mutateAsync({ roleId, permissionId });
        toast.success("Permesso assegnato");
      }
    } catch (err) {
      toast.error(`Errore: ${err instanceof Error ? err.message : "Impossibile aggiornare il permesso"}`);
    }
  };

  const groupedPerms = permissions.reduce(
    (acc, perm) => {
      const module = perm.module || "Altro";
      if (!acc[module]) acc[module] = [];
      acc[module].push(perm);
      return acc;
    },
    {} as Record<string, typeof permissions>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gestione Ruoli</h3>
          <p className="text-sm text-muted-foreground">Configura ruoli e permessi del sistema</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} disabled={rolesLoading}>
          <Plus className="h-4 w-4 mr-2" />
          Nuovo Ruolo
        </Button>
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crea Nuovo Ruolo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Es: supervisore" />
            </div>
            <div>
              <label className="text-sm font-medium">Descrizione</label>
              <Input value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} placeholder="Descrizione opzionale" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleCreateRole} disabled={createRoleMut.isPending}>
              {createRoleMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Ruoli</CardTitle>
          <CardDescription>Elenco di tutti i ruoli configurati nel sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {rolesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="text-center">Sistema</TableHead>
                    <TableHead className="text-right w-20">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{role.description || "-"}</TableCell>
                      <TableCell className="text-center">
                        {role.is_system ? <Badge variant="secondary">Si</Badge> : <Badge variant="outline">No</Badge>}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRoleForPerms(role.id);
                            setEditingRoleId(role.id);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {!role.is_system && (
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteRole(role.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permissions Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assegna Permessi - {roles.find((r) => r.id === editingRoleId)?.name}</DialogTitle>
          </DialogHeader>
          {rolePermsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6 max-h-96 overflow-y-auto">
              {Object.entries(groupedPerms).map(([module, perms]) => (
                <div key={module}>
                  <h4 className="font-semibold mb-3 text-sm">{module}</h4>
                  <div className="grid grid-cols-1 gap-3">
                    {perms.map((perm) => (
                      <div key={perm.id} className="flex items-center space-x-3">
                        <Checkbox
                          id={perm.id}
                          checked={rolePermIds.has(perm.id)}
                          onCheckedChange={() => editingRoleId && handleTogglePermission(editingRoleId, perm.id)}
                        />
                        <label htmlFor={perm.id} className="text-sm cursor-pointer flex-1">
                          <div className="font-medium">{perm.key}</div>
                          <div className="text-xs text-muted-foreground">{perm.description}</div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setEditDialogOpen(false)}>Fatto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

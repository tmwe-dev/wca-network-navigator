/**
 * Team Management Panel
 * Manage teams, members, and team roles
 */
import { useState } from "react";
import { useTeams, useTeamMembers, useCreateTeam, useUpdateTeam, useDeleteTeam, useAddTeamMember, useRemoveTeamMember, useUpdateMemberRole } from "@/hooks/useRBAC";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Edit2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export default function TeamManagementPanel() {
  const { data: teams = [], isLoading: teamsLoading } = useTeams();
  const createTeamMut = useCreateTeam();
  const updateTeamMut = useUpdateTeam();
  const deleteTeamMut = useDeleteTeam();
  const addMemberMut = useAddTeamMember();
  const removeMemberMut = useRemoveTeamMember();
  const updateMemberRoleMut = useUpdateMemberRole();

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const { data: teamMembers = [], isLoading: membersLoading } = useTeamMembers(selectedTeamId ?? "");

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");

  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("member");

  // Fetch all users for member assignment
  const { data: allUsers = [] } = useQuery({
    queryKey: ["authorized-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("authorized_users").select("id, email, display_name").order("email");
      if (error) throw error;
      return data || [];
    },
  });

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      toast.error("Il nome del team è obbligatorio");
      return;
    }

    try {
      await createTeamMut.mutateAsync({
        name: newTeamName,
        description: newTeamDesc || undefined,
      });
      toast.success("Team creato con successo");
      setNewTeamName("");
      setNewTeamDesc("");
      setCreateDialogOpen(false);
    } catch (err) {
      toast.error(`Errore: ${err instanceof Error ? err.message : "Impossibile creare il team"}`);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    if (!window.confirm(`Sei sicuro di voler eliminare il team "${team?.name}"?`)) {
      return;
    }

    try {
      await deleteTeamMut.mutateAsync(teamId);
      toast.success("Team eliminato con successo");
      setSelectedTeamId(null);
    } catch (err) {
      toast.error(`Errore: ${err instanceof Error ? err.message : "Impossibile eliminare il team"}`);
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeamId || !newMemberEmail.trim()) {
      toast.error("Seleziona un membro valido");
      return;
    }

    const user = allUsers.find((u) => u.email === newMemberEmail);
    if (!user) {
      toast.error("Utente non trovato");
      return;
    }

    try {
      await addMemberMut.mutateAsync({
        teamId: selectedTeamId,
        userId: user.id,
        role: newMemberRole,
      });
      toast.success("Membro aggiunto con successo");
      setNewMemberEmail("");
      setNewMemberRole("member");
      setAddMemberDialogOpen(false);
    } catch (err) {
      toast.error(`Errore: ${err instanceof Error ? err.message : "Impossibile aggiungere il membro"}`);
    }
  };

  const handleRemoveMember = async (teamId: string, userId: string) => {
    if (!window.confirm("Sei sicuro di voler rimuovere questo membro?")) {
      return;
    }

    try {
      await removeMemberMut.mutateAsync({ teamId, userId });
      toast.success("Membro rimosso con successo");
    } catch (err) {
      toast.error(`Errore: ${err instanceof Error ? err.message : "Impossibile rimuovere il membro"}`);
    }
  };

  const handleUpdateMemberRole = async (teamId: string, userId: string, newRole: string) => {
    try {
      await updateMemberRoleMut.mutateAsync({ teamId, userId, role: newRole });
      toast.success("Ruolo del membro aggiornato");
    } catch (err) {
      toast.error(`Errore: ${err instanceof Error ? err.message : "Impossibile aggiornare il ruolo"}`);
    }
  };

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gestione Team</h3>
          <p className="text-sm text-muted-foreground">Organizza utenti in team per una collaborazione migliore</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} disabled={teamsLoading}>
          <Plus className="h-4 w-4 mr-2" />
          Nuovo Team
        </Button>
      </div>

      {/* Create Team Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crea Nuovo Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <Input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Es: Sales Team" />
            </div>
            <div>
              <label className="text-sm font-medium">Descrizione</label>
              <Input value={newTeamDesc} onChange={(e) => setNewTeamDesc(e.target.value)} placeholder="Descrizione opzionale" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleCreateTeam} disabled={createTeamMut.isPending}>
              {createTeamMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi Membro a {selectedTeam?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email Utente</label>
              <Select value={newMemberEmail} onValueChange={setNewMemberEmail}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona utente..." />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.map((user) => (
                    <SelectItem key={user.id} value={user.email}>
                      {user.display_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Ruolo nel Team</label>
              <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="leader">Leader</SelectItem>
                  <SelectItem value="admin">Admin Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleAddMember} disabled={addMemberMut.isPending}>
              {addMemberMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Aggiungi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Teams and Members Tabs */}
      <Tabs value={selectedTeamId || "list"} onValueChange={(v) => setSelectedTeamId(v === "list" ? null : v)}>
        <TabsList>
          <TabsTrigger value="list">Team ({teams.length})</TabsTrigger>
          {selectedTeam && <TabsTrigger value={selectedTeamId || ""}>{selectedTeam.name}</TabsTrigger>}
        </TabsList>

        {/* Teams List Tab */}
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>Team Disponibili</CardTitle>
            </CardHeader>
            <CardContent>
              {teamsLoading ? (
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
                        <TableHead className="text-center">Membri</TableHead>
                        <TableHead>Creato</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teams.map((team) => (
                        <TableRow key={team.id}>
                          <TableCell className="font-medium">{team.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{team.description || "-"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{teamMembers.length}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{format(new Date(team.created_at), "PPP", { locale: it })}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedTeamId(team.id)}>
                              <Users className="h-4 w-4 mr-2" />
                              Dettagli
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteTeam(team.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Members Tab */}
        {selectedTeam && (
          <TabsContent value={selectedTeamId || ""}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Membri di {selectedTeam.name}</CardTitle>
                  <CardDescription>{selectedTeam.description}</CardDescription>
                </div>
                <Button onClick={() => setAddMemberDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Membro
                </Button>
              </CardHeader>
              <CardContent>
                {membersLoading ? (
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
                          <TableHead>Ruolo nel Team</TableHead>
                          <TableHead>Entrato</TableHead>
                          <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamMembers.map((member) => {
                          const user = allUsers.find((u) => u.id === member.user_id);
                          return (
                            <TableRow key={member.user_id}>
                              <TableCell className="font-medium">{user?.email}</TableCell>
                              <TableCell>{user?.display_name || "-"}</TableCell>
                              <TableCell>
                                <Select value={member.role} onValueChange={(role) => handleUpdateMemberRole(selectedTeamId, member.user_id, role)}>
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="member">Membro</SelectItem>
                                    <SelectItem value="leader">Leader</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-sm">{format(new Date(member.joined_at), "PPP", { locale: it })}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(selectedTeamId, member.user_id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

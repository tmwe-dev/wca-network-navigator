import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Shield, UserCheck, UserX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { queryKeys } from "@/lib/queryKeys";

type AuthorizedUser = {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  last_login_at: string | null;
  login_count: number;
  created_at: string;
};

export default function AdminUsers() {
  const qc = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  const { data: myProfile, isLoading: profileLoading } = useQuery({
    queryKey: queryKeys.operators.adminCheck,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("operators").select("is_admin").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  const isAdmin = myProfile?.is_admin ?? false;

  const { data: users = [], isLoading } = useQuery({
    enabled: isAdmin,
    queryKey: queryKeys.authorizedUsers.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("authorized_users")
        .select("id, email, display_name, is_active, last_login_at, login_count, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as AuthorizedUser[];
    },
  });

  const addUser = useMutation({
    mutationFn: async () => {
      if (!newEmail.trim()) throw new Error("Email obbligatoria");
      const { error } = await supabase
        .from("authorized_users")
        .insert([{ email: newEmail.trim().toLowerCase(), display_name: newName.trim() || null }]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.authorizedUsers.all });
      setNewEmail("");
      setNewName("");
      toast.success("Utente autorizzato aggiunto");
    },
    onError: (e: Error) => toast.error(e.message.includes("duplicate") ? "Email già presente" : e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("authorized_users")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.authorizedUsers.all });
      toast.success("Stato aggiornato");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("authorized_users")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.authorizedUsers.all });
      toast.success("Utente rimosso");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <CardTitle>Utenti Autorizzati</CardTitle>
          </div>
          <CardDescription>
            Solo le email presenti in questa lista possono accedere alla piattaforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new user form */}
          <div className="flex gap-2">
            <Input
              placeholder="email@esempio.com"
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Nome (opzionale)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-48"
            />
            <Button
              onClick={() => addUser.mutate()}
              disabled={addUser.isPending || !newEmail.trim()}
              size="sm"
              className="gap-1"
            >
              {addUser.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Aggiungi
            </Button>
          </div>

          {/* Users table */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nessun utente autorizzato. Aggiungi il primo per attivare la whitelist.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-center">Stato</TableHead>
                    <TableHead className="text-center">Accessi</TableHead>
                    <TableHead>Ultimo accesso</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell className="text-muted-foreground">{u.display_name || "—"}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={u.is_active}
                            onCheckedChange={(v) => toggleActive.mutate({ id: u.id, is_active: v })}
                          />
                          {u.is_active ? (
                            <Badge variant="default" className="gap-1">
                              <UserCheck className="w-3 h-3" /> Attivo
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <UserX className="w-3 h-3" /> Disattivo
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono">{u.login_count}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {u.last_login_at ? format(new Date(u.last_login_at), "dd/MM/yyyy HH:mm") : "Mai"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Elimina"
                          onClick={() => {
                            if (confirm(`Rimuovere ${u.email} dalla whitelist?`)) {
                              deleteUser.mutate(u.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Totale: {users.length} utenti autorizzati · {users.filter(u => u.is_active).length} attivi
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

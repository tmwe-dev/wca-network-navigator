import { useState } from "react";
import { useOperators, useUpsertOperator, useDeleteOperator, useCurrentOperator, type Operator } from "@/hooks/useOperators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Edit, Shield, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

export default function OperatorsSettings() {
  const { data: operators = [], isLoading } = useOperators();
  const { data: currentOp } = useCurrentOperator();
  const upsert = useUpsertOperator();
  const deleteOp = useDeleteOperator();
  const [editOp, setEditOp] = useState<Partial<Operator> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const isAdmin = currentOp?.is_admin || operators.length === 0;

  const handleSave = async () => {
    if (!editOp?.name || !editOp?.email) {
      toast.error("Nome e email sono obbligatori");
      return;
    }
    await upsert.mutateAsync(editOp as any);
    setDialogOpen(false);
    setEditOp(null);
  };

  const openNew = () => {
    setEditOp({ name: "", email: "", is_admin: false, is_active: true, imap_host: "imaps.aruba.it", smtp_host: "smtps.aruba.it", smtp_port: 465 });
    setDialogOpen(true);
  };

  const openEdit = (op: Operator) => {
    setEditOp({ ...op });
    setDialogOpen(true);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (currentOp && !currentOp.is_admin && operators.length > 0) {
    return <div className="p-8 text-center text-muted-foreground">Accesso riservato agli amministratori</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operatori</h1>
          <p className="text-sm text-muted-foreground">Gestisci gli operatori che possono utilizzare il sistema</p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="gap-1.5">
            <Plus className="w-4 h-4" /> Nuovo Operatore
          </Button>
        )}
      </div>

      {operators.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <p className="text-muted-foreground">Nessun operatore configurato</p>
            <p className="text-sm text-muted-foreground">Il primo operatore creato sarà automaticamente admin</p>
            <Button onClick={openNew} className="gap-1.5 mt-2">
              <Plus className="w-4 h-4" /> Crea il primo operatore
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {operators.map(op => (
          <Card key={op.id} className={!op.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {op.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {op.name}
                      {op.is_admin && <Badge variant="secondary" className="gap-1"><Shield className="w-3 h-3" /> Admin</Badge>}
                      {!op.is_active && <Badge variant="outline">Disabilitato</Badge>}
                      {op.user_id === currentOp?.user_id && <Badge variant="default" className="text-[10px]">Tu</Badge>}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{op.email}</p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(op)}><Edit className="w-4 h-4" /></Button>
                    {op.user_id !== currentOp?.user_id && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteOp.mutate(op.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-4 text-xs text-muted-foreground">
                {op.imap_user && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {op.imap_user}</span>}
                {op.whatsapp_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {op.whatsapp_phone}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editOp?.id ? "Modifica Operatore" : "Nuovo Operatore"}</DialogTitle>
          </DialogHeader>
          {editOp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome *</Label>
                  <Input value={editOp.name || ""} onChange={e => setEditOp({ ...editOp, name: e.target.value })} />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input value={editOp.email || ""} onChange={e => setEditOp({ ...editOp, email: e.target.value })} />
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">Credenziali Email (IMAP)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Host IMAP</Label>
                    <Input value={editOp.imap_host || ""} onChange={e => setEditOp({ ...editOp, imap_host: e.target.value })} />
                  </div>
                  <div>
                    <Label>Utente IMAP</Label>
                    <Input value={editOp.imap_user || ""} onChange={e => setEditOp({ ...editOp, imap_user: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">Credenziali Email (SMTP)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Host SMTP</Label>
                    <Input value={editOp.smtp_host || ""} onChange={e => setEditOp({ ...editOp, smtp_host: e.target.value })} />
                  </div>
                  <div>
                    <Label>Utente SMTP</Label>
                    <Input value={editOp.smtp_user || ""} onChange={e => setEditOp({ ...editOp, smtp_user: e.target.value })} />
                  </div>
                  <div>
                    <Label>Porta</Label>
                    <Input type="number" value={editOp.smtp_port || 465} onChange={e => setEditOp({ ...editOp, smtp_port: Number(e.target.value) })} />
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">Canali</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Telefono WhatsApp</Label>
                    <Input value={editOp.whatsapp_phone || ""} onChange={e => setEditOp({ ...editOp, whatsapp_phone: e.target.value })} placeholder="+39..." />
                  </div>
                  <div>
                    <Label>Profilo LinkedIn</Label>
                    <Input value={editOp.linkedin_profile_url || ""} onChange={e => setEditOp({ ...editOp, linkedin_profile_url: e.target.value })} placeholder="https://linkedin.com/in/..." />
                  </div>
                </div>
              </div>

              <div className="border-t pt-3 flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={editOp.is_admin || false} onCheckedChange={v => setEditOp({ ...editOp, is_admin: v })} />
                  <Label>Admin</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editOp.is_active !== false} onCheckedChange={v => setEditOp({ ...editOp, is_active: v })} />
                  <Label>Attivo</Label>
                </div>
              </div>

              <Button onClick={handleSave} disabled={upsert.isPending} className="w-full">
                {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editOp.id ? "Salva Modifiche" : "Crea Operatore"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

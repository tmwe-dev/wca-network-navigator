import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSharedMailboxes,
  upsertSharedMailbox,
  deleteSharedMailbox,
  type SharedMailbox,
  type SharedMailboxUpsert,
} from "@/data/mailboxes";
import { useCurrentOperator } from "@/hooks/useOperators";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SharedMailboxesPanel() {
  const { data: currentOp } = useCurrentOperator();
  const isAdmin = !!currentOp?.is_admin;
  const qc = useQueryClient();

  const { data: mailboxes = [], isLoading } = useQuery({
    queryKey: queryKeys.email.mailboxesAll,
    queryFn: listSharedMailboxes,
  });

  const [editing, setEditing] = useState<Partial<SharedMailbox> | null>(null);
  const [open, setOpen] = useState(false);

  const upsert = useMutation({
    mutationFn: (input: SharedMailboxUpsert) => upsertSharedMailbox(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.email.mailboxesAll });
      qc.invalidateQueries({ queryKey: queryKeys.email.mailboxes });
      toast.success("Casella salvata");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: unknown) => toast.error(`Errore: ${(e as Error).message}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSharedMailbox(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.email.mailboxesAll });
      qc.invalidateQueries({ queryKey: queryKeys.email.mailboxes });
      toast.success("Casella rimossa");
    },
    onError: (e: unknown) => toast.error(`Errore: ${(e as Error).message}`),
  });

  if (!isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">Accesso riservato agli amministratori</div>;
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const openNew = () => {
    setEditing({
      slug: "",
      label: "",
      email: "",
      department: "booking",
      imap_host: "imaps.aruba.it",
      imap_port: 993,
      smtp_host: "smtps.aruba.it",
      smtp_port: 465,
      is_active: true,
      auto_grant: false,
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (!editing?.slug || !editing.label || !editing.email || !editing.department) {
      toast.error("Slug, etichetta, email e reparto sono obbligatori");
      return;
    }
    upsert.mutate(editing as SharedMailboxUpsert);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Caselle di posta aziendali</h1>
          <p className="text-sm text-muted-foreground">
            Caselle condivise (booking, amministrazione…) accessibili agli operatori autorizzati.
          </p>
        </div>
        <Button onClick={openNew} className="gap-1.5"><Plus className="w-4 h-4" /> Nuova casella</Button>
      </div>

      <div className="grid gap-3">
        {mailboxes.map((m) => (
          <Card key={m.id} className={!m.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base flex items-center gap-2 truncate">
                      {m.label}
                      <Badge variant="outline" className="text-[10px] uppercase">{m.department}</Badge>
                      {m.auto_grant && <Badge variant="secondary" className="text-[10px]">Auto-assegnata</Badge>}
                      {!m.is_active && <Badge variant="outline">Disattiva</Badge>}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground truncate">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(`Rimuovere ${m.label}?`)) remove.mutate(m.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              {m.imap_user
                ? <span>IMAP: {m.imap_user}@{m.imap_host}</span>
                : <span className="text-amber-500">⚠ Credenziali IMAP/SMTP da configurare</span>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Modifica casella" : "Nuova casella aziendale"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Slug *</Label>
                  <Input value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="booking" />
                </div>
                <div>
                  <Label>Etichetta *</Label>
                  <Input value={editing.label || ""} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="Booking" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email *</Label>
                  <Input value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} placeholder="booking@tmwe.it" />
                </div>
                <div>
                  <Label>Reparto *</Label>
                  <Input value={editing.department || ""} onChange={(e) => setEditing({ ...editing, department: e.target.value })} placeholder="booking" />
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">IMAP</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Host</Label>
                    <Input value={editing.imap_host || ""} onChange={(e) => setEditing({ ...editing, imap_host: e.target.value })} />
                  </div>
                  <div>
                    <Label>Utente</Label>
                    <Input value={editing.imap_user || ""} onChange={(e) => setEditing({ ...editing, imap_user: e.target.value })} />
                  </div>
                  <div>
                    <Label>Porta</Label>
                    <Input type="number" value={editing.imap_port ?? 993} onChange={(e) => setEditing({ ...editing, imap_port: Number(e.target.value) })} />
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">SMTP</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Host</Label>
                    <Input value={editing.smtp_host || ""} onChange={(e) => setEditing({ ...editing, smtp_host: e.target.value })} />
                  </div>
                  <div>
                    <Label>Utente</Label>
                    <Input value={editing.smtp_user || ""} onChange={(e) => setEditing({ ...editing, smtp_user: e.target.value })} />
                  </div>
                  <div>
                    <Label>Porta</Label>
                    <Input type="number" value={editing.smtp_port ?? 465} onChange={(e) => setEditing({ ...editing, smtp_port: Number(e.target.value) })} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Le password vanno inserite separatamente (cifrate lato edge). Form dedicato in arrivo.
                </p>
              </div>

              <div className="border-t pt-3">
                <Label>Reply-To</Label>
                <Input value={editing.reply_to || ""} onChange={(e) => setEditing({ ...editing, reply_to: e.target.value })} />
              </div>

              <div className="border-t pt-3 flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={editing.auto_grant ?? false} onCheckedChange={(v) => setEditing({ ...editing, auto_grant: v })} />
                  <Label>Auto-assegnata a tutti i nuovi operatori</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editing.is_active !== false} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  <Label>Attiva</Label>
                </div>
              </div>

              <Button onClick={handleSave} disabled={upsert.isPending} className="w-full">
                {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editing.id ? "Salva modifiche" : "Crea casella"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
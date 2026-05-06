/**
 * AlertRoutingPage — /v2/settings/alert-routing
 * Rubrica responsabili che ricevono alert WhatsApp urgenti TMWE.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { queryKeys } from "@/lib/queryKeys";
import {
  listAlertRecipients,
  listAlertDispatchLog,
  upsertAlertRecipient,
  deleteAlertRecipient,
  type AlertRecipient,
} from "@/data/alertRecipients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Plus, AlertTriangle } from "lucide-react";
import { PageShell } from "@/v2/ui/templates/PageShell";

const CATEGORIES = [
  { id: "operations_urgent", label: "Operations urgent" },
  { id: "admin_urgent", label: "Admin urgent" },
  { id: "commercial_urgent", label: "Commercial urgent" },
];

export function AlertRoutingPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();

  const recipientsQ = useQuery({
    queryKey: queryKeys.alertRouting.recipients(userId),
    queryFn: () => listAlertRecipients(userId),
    enabled: !!userId,
  });

  const logQ = useQuery({
    queryKey: queryKeys.alertRouting.log(userId),
    queryFn: () => listAlertDispatchLog(userId, 50),
    enabled: !!userId,
  });

  const [draft, setDraft] = useState<Partial<AlertRecipient>>({
    name: "",
    role: "",
    whatsapp_e164: "",
    categories: [],
    min_urgency_score: 70,
    is_active: true,
    timezone: "Europe/Rome",
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: queryKeys.alertRouting.recipients(userId) });
    qc.invalidateQueries({ queryKey: queryKeys.alertRouting.log(userId) });
  };

  const save = async () => {
    if (!draft.name || !draft.whatsapp_e164) {
      toast.error("Nome e numero WhatsApp obbligatori");
      return;
    }
    try {
      await upsertAlertRecipient(userId, {
        name: draft.name,
        whatsapp_e164: draft.whatsapp_e164,
        role: draft.role ?? null,
        categories: draft.categories ?? [],
        min_urgency_score: draft.min_urgency_score ?? 70,
        is_active: draft.is_active ?? true,
        timezone: draft.timezone ?? "Europe/Rome",
      });
      toast.success("Responsabile salvato");
      setDraft({ name: "", role: "", whatsapp_e164: "", categories: [], min_urgency_score: 70, is_active: true, timezone: "Europe/Rome" });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare questo responsabile?")) return;
    try {
      await deleteAlertRecipient(id);
      toast.success("Eliminato");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggleCat = (cat: string) => {
    const cur = new Set(draft.categories ?? []);
    if (cur.has(cat)) cur.delete(cat);
    else cur.add(cat);
    setDraft({ ...draft, categories: [...cur] });
  };

  return (
    <PageShell
      title={
        <span className="inline-flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-destructive" /> Alert Routing — TMWE
        </span>
      }
      description="Quando un'email inbound viene classificata urgente, il sistema invia un alert WhatsApp ai responsabili qui sotto."
    >
      <Card className="p-4 space-y-4">
        <h2 className="font-semibold">Aggiungi responsabile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Nome</Label>
            <Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Mario Rossi" />
          </div>
          <div>
            <Label>Ruolo</Label>
            <Input value={draft.role ?? ""} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="Resp. operations" />
          </div>
          <div>
            <Label>WhatsApp (E.164)</Label>
            <Input value={draft.whatsapp_e164 ?? ""} onChange={(e) => setDraft({ ...draft, whatsapp_e164: e.target.value })} placeholder="+39333..." />
          </div>
          <div>
            <Label>Soglia urgenza minima (0-100)</Label>
            <Input
              type="number"
              value={draft.min_urgency_score ?? 70}
              onChange={(e) => setDraft({ ...draft, min_urgency_score: Number(e.target.value) })}
            />
          </div>
        </div>
        <div>
          <Label>Categorie alert</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {CATEGORIES.map((c) => {
              const active = (draft.categories ?? []).includes(c.id);
              return (
                <Badge
                  key={c.id}
                  variant={active ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleCat(c.id)}
                >
                  {c.label}
                </Badge>
              );
            })}
          </div>
        </div>
        <Button onClick={save}>
          <Plus className="h-4 w-4 mr-1" /> Salva responsabile
        </Button>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Responsabili in rubrica ({recipientsQ.data?.length ?? 0})</h2>
        <div className="space-y-2">
          {(recipientsQ.data ?? []).map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3 border rounded">
              <div>
                <div className="font-medium">{r.name} <span className="text-muted-foreground text-sm">{r.role}</span></div>
                <div className="text-sm text-muted-foreground">{r.whatsapp_e164} · soglia {r.min_urgency_score}</div>
                <div className="flex gap-1 mt-1">
                  {r.categories.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
                  {!r.is_active && <Badge variant="outline">disattivo</Badge>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {recipientsQ.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nessun responsabile configurato.</p>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Ultimi alert inviati</h2>
        <div className="space-y-1 text-sm">
          {(logQ.data ?? []).map((l) => (
            <div key={l.id} className="flex items-center gap-3 py-1 border-b">
              <Badge variant={l.status === "sent" ? "default" : "destructive"}>{l.status}</Badge>
              <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
              <span>{l.business_category}</span>
              <span className="text-muted-foreground">urgency {l.urgency_score}</span>
            </div>
          ))}
          {(logQ.data ?? []).length === 0 && (
            <p className="text-muted-foreground">Nessun alert ancora inviato.</p>
          )}
        </div>
      </Card>
    </PageShell>
  );
}

export default AlertRoutingPage;
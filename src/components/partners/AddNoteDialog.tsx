/**
 * AddNoteDialog — modal per aggiungere nota/chiamata/incontro a un partner.
 * Inserisce in `interactions`. Il flag "in circuito di attesa" è informativo:
 * il partner risulta in holding non appena esiste un'interazione recente.
 */
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createInteraction } from "@/data/interactions";
import { activityKeys, insertActivity } from "@/data/activities";
import { updatePartner } from "@/data/partners";
import { useAuth } from "@/providers/AuthProvider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partnerId: string;
}

type IType = "note" | "call" | "meeting" | "email";

export function AddNoteDialog({ open, onOpenChange, partnerId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [type, setType] = React.useState<IType>("note");
  const [subject, setSubject] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [holding, setHolding] = React.useState(false);

  React.useEffect(() => {
    setHolding(type === "call");
  }, [type]);

  const m = useMutation({
    mutationFn: async () => {
      const subj = subject || (type === "note" ? "Nota" : type === "call" ? "Chiamata" : type === "meeting" ? "Incontro" : "Email");
      await createInteraction({
        partner_id: partnerId,
        interaction_type: type,
        subject: subj,
        notes: notes || null,
        user_id: user?.id ?? null,
        created_by: user?.id ?? null,
      });

      // Ogni interazione manuale è anche un'attività in agenda dell'operatore
      const activityType: "phone_call" | "meeting" | "send_email" | "other" =
        type === "call" ? "phone_call"
        : type === "meeting" ? "meeting"
        : type === "email" ? "send_email"
        : "other";
      const today = new Date().toISOString().slice(0, 10);
      await insertActivity({
        partner_id: partnerId,
        source_type: "partner",
        source_id: partnerId,
        activity_type: activityType,
        title: subj,
        description: notes || null,
        priority: "medium",
        due_date: today,
        user_id: user?.id ?? null,
        status: "completed",
        completed_at: new Date().toISOString(),
        reviewed: true,
      });

      // Se l'operatore ha spuntato "in circuito di attesa", aggiorna lo stato
      // commerciale del partner così tutta l'app (card, filtri, agenda, holding
      // tab) lo vede come acceso.
      if (holding) {
        await updatePartner(partnerId, { lead_status: "holding" });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activityKeys.forPartner(partnerId) });
      qc.invalidateQueries({ queryKey: activityKeys.all });
      qc.invalidateQueries({ queryKey: ["partner", partnerId] });
      toast.success(holding ? "Salvato. Azienda in circuito di attesa." : "Salvato.");
      setSubject(""); setNotes(""); setType("note"); setHolding(false);
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      toast.error("Errore: " + (e instanceof Error ? e.message : "sconosciuto"));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiungi attività</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
            <Select value={type} onValueChange={(v) => setType(v as IType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="note">📝 Nota</SelectItem>
                <SelectItem value="call">📞 Chiamata</SelectItem>
                <SelectItem value="meeting">🤝 Incontro</SelectItem>
                <SelectItem value="email">✉️ Email (manuale)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Oggetto</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Es. Chiamata con Mario Rossi" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Note</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Cosa è successo, prossimi passi…" />
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
            <Checkbox checked={holding} onCheckedChange={(v) => setHolding(Boolean(v))} />
            Metti l'azienda in circuito di attesa
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
/**
 * CreateActivityDrawer — Form to create new activities
 */
import * as React from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { Button } from "../atoms/Button";
import { toast } from "sonner";
import { X } from "lucide-react";

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: () => void;
}

const TYPES = [
  { value: "email", label: "Email" },
  { value: "call", label: "Chiamata" },
  { value: "follow_up", label: "Follow-up" },
  { value: "meeting", label: "Riunione" },
  { value: "whatsapp_message", label: "WhatsApp" },
  { value: "note", label: "Nota" },
] as const;

const PRIORITIES = ["low", "medium", "high"] as const;

export function CreateActivityDrawer({ open, onClose, onCreated }: Props): React.ReactElement | null {
  const { session } = useAuthV2();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("follow_up");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");

  const createMut = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Titolo obbligatorio");
      const { error } = await supabase.from("activities").insert({
        title: title.trim(),
        activity_type: type as "email",
        priority,
        due_date: dueDate || null,
        description: description || null,
        source_id: crypto.randomUUID(),
        source_type: "manual",
        user_id: session?.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attività creata");
      setTitle(""); setDescription(""); setDueDate("");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border-l shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-foreground">Nuova Attività</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Titolo *</label>
            <input className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es: Follow-up con ABC Logistics" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tipo</label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Priorità</label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p === "low" ? "Bassa" : p === "medium" ? "Media" : "Alta"}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Scadenza</label>
            <input type="date" className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Descrizione</label>
            <textarea className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground min-h-[120px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Note aggiuntive..." />
          </div>
        </div>
        <div className="p-4 border-t">
          <Button onClick={() => createMut.mutate()} isLoading={createMut.isPending} className="w-full">Crea Attività</Button>
        </div>
      </div>
    </div>
  );
}

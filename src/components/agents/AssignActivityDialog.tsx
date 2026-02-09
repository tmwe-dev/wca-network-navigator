import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTeamMembers, useCreateTeamMember } from "@/hooks/useTeamMembers";
import { useCreateActivities } from "@/hooks/useActivities";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const ACTIVITY_TYPES = [
  { value: "send_email", label: "Inviare Email" },
  { value: "phone_call", label: "Telefonata" },
  { value: "add_to_campaign", label: "Inserire in Campagna" },
  { value: "meeting", label: "Meeting" },
  { value: "follow_up", label: "Follow-up" },
  { value: "other", label: "Altro" },
];

const PRIORITIES = [
  { value: "low", label: "Bassa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
];

interface AssignActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerIds: string[];
  onSuccess?: () => void;
}

export function AssignActivityDialog({
  open,
  onOpenChange,
  partnerIds,
  onSuccess,
}: AssignActivityDialogProps) {
  const { data: members = [] } = useTeamMembers();
  const createActivities = useCreateActivities();
  const createMember = useCreateTeamMember();

  type ActivityTypeEnum = "send_email" | "phone_call" | "add_to_campaign" | "meeting" | "follow_up" | "other";
  const [activityType, setActivityType] = useState<ActivityTypeEnum>("send_email");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");

  // New member inline form
  const [showNewMember, setShowNewMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");

  const typeLabel = ACTIVITY_TYPES.find((t) => t.value === activityType)?.label || "";
  const autoTitle = `${typeLabel} — ${partnerIds.length} agente${partnerIds.length !== 1 ? "i" : ""}`;

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    try {
      const member = await createMember.mutateAsync({
        name: newMemberName.trim(),
        email: newMemberEmail.trim() || undefined,
        role: newMemberRole.trim() || undefined,
      });
      setAssignedTo(member.id);
      setShowNewMember(false);
      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberRole("");
      toast.success("Rappresentante aggiunto");
    } catch {
      toast.error("Errore nell'aggiunta");
    }
  };

  const handleSubmit = async () => {
    const finalTitle = title.trim() || autoTitle;
    const activities = partnerIds.map((pid) => ({
      partner_id: pid,
      assigned_to: assignedTo || null,
      activity_type: activityType,
      title: finalTitle,
      description: description.trim() || undefined,
      priority,
      due_date: dueDate || null,
    }));

    try {
      await createActivities.mutateAsync(activities);
      toast.success(`${activities.length} attività create`);
      onOpenChange(false);
      onSuccess?.();
      // Reset
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setAssignedTo("");
    } catch {
      toast.error("Errore nella creazione delle attività");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assegna Attività</DialogTitle>
          <DialogDescription>
            Crea un'attività per {partnerIds.length} agente{partnerIds.length !== 1 ? "i" : ""} selezionat{partnerIds.length !== 1 ? "i" : "o"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tipo attività</label>
            <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityTypeEnum)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Titolo</label>
            <Input
              placeholder={autoTitle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Note / Descrizione</label>
            <Textarea
              placeholder="Descrizione opzionale..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Priorità</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Scadenza</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Assegna a</label>
            <div className="flex gap-2">
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Nessuno (non assegnato)" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}{m.role ? ` — ${m.role}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => setShowNewMember(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {showNewMember && (
            <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
              <p className="text-xs font-semibold">Nuovo rappresentante</p>
              <Input placeholder="Nome *" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Email" value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} />
                <Input placeholder="Ruolo" value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowNewMember(false)}>Annulla</Button>
                <Button size="sm" onClick={handleAddMember} disabled={!newMemberName.trim()}>Aggiungi</Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={createActivities.isPending}>
            Crea {partnerIds.length} attività
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateActivities } from "@/hooks/useActivities";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { toast } from "sonner";

interface AssignActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerIds: string[];
  onSuccess: () => void;
}

const activityTypes = [
  { value: "send_email", label: "Invia Email" },
  { value: "phone_call", label: "Telefonata" },
  { value: "meeting", label: "Meeting" },
  { value: "follow_up", label: "Follow-up" },
  { value: "other", label: "Altro" },
] as const;

export function AssignActivityDialog({ open, onOpenChange, partnerIds, onSuccess }: AssignActivityDialogProps) {
  const [title, setTitle] = useState("");
  const [activityType, setActivityType] = useState<string>("follow_up");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const { data: members = [] } = useTeamMembers();
  const createActivities = useCreateActivities();

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Inserisci un titolo");
      return;
    }
    const activities = partnerIds.map((pid) => ({
      partner_id: pid,
      activity_type: activityType as any,
      title: title.trim(),
      assigned_to: assignedTo || null,
    }));
    await createActivities.mutateAsync(activities);
    toast.success(`${partnerIds.length} attività create`);
    setTitle("");
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assegna Attività ({partnerIds.length} partner)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Titolo attività..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Select value={activityType} onValueChange={setActivityType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {activityTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {members.length > 0 && (
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Assegna a..." /></SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleSubmit} disabled={createActivities.isPending} className="w-full">
            {createActivities.isPending ? "Creazione..." : "Crea Attività"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

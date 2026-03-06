import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useCreateActivities } from "@/hooks/useActivities";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { toast } from "sonner";
import {
  Mail, Phone, CalendarClock, Users, Loader2, CheckCircle2,
  ClipboardList, Calendar, Flag, UserCheck, MessageSquare,
} from "lucide-react";

interface AssignActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerIds: string[];
  partnerNames?: Record<string, string>;
  onSuccess: () => void;
  /** Override source_type (default: "partner") */
  sourceType?: "partner" | "prospect" | "contact";
  /** Extra source_meta fields merged per-item */
  extraSourceMeta?: Record<string, Record<string, any>>;
}

type ActivityTypeValue = "send_email" | "phone_call" | "meeting" | "follow_up" | "other";

const activityTypes = [
  { value: "send_email" as const, label: "Invia Email", icon: Mail },
  { value: "phone_call" as const, label: "Telefonata", icon: Phone },
  { value: "meeting" as const, label: "Meeting", icon: Users },
  { value: "follow_up" as const, label: "Follow-up", icon: CalendarClock },
  { value: "other" as const, label: "Altro", icon: ClipboardList },
];

const priorities = [
  { value: "low", label: "Bassa", color: "text-muted-foreground" },
  { value: "medium", label: "Media", color: "text-yellow-500" },
  { value: "high", label: "Alta", color: "text-destructive" },
];

export function AssignActivityDialog({ open, onOpenChange, partnerIds, partnerNames, onSuccess, sourceType = "partner", extraSourceMeta }: AssignActivityDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activityType, setActivityType] = useState<ActivityTypeValue>("follow_up");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [useCampaignBatch, setUseCampaignBatch] = useState(false);
  const [campaignBatchId, setCampaignBatchId] = useState("");
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const { data: members = [] } = useTeamMembers();
  const createActivities = useCreateActivities();

  // Auto-generate title based on type
  const autoTitle = useMemo(() => {
    const typeLabel = activityTypes.find(t => t.value === activityType)?.label || "";
    return `${typeLabel} — ${new Date().toLocaleDateString("it-IT")}`;
  }, [activityType]);

  const effectiveTitle = title.trim() || autoTitle;
  const batchId = useCampaignBatch
    ? (campaignBatchId.trim() || `batch_${Date.now()}`)
    : null;

  const handleSubmit = async () => {
    setCreating(true);
    setProgress({ done: 0, total: partnerIds.length });

    try {
      // Create in chunks of 50 to avoid hitting limits
      const CHUNK = 50;
      let done = 0;

      for (let i = 0; i < partnerIds.length; i += CHUNK) {
        const chunk = partnerIds.slice(i, i + CHUNK);
        const activities = chunk.map((pid) => ({
          partner_id: sourceType === "partner" ? pid : null,
          source_type: sourceType,
          source_id: pid,
          activity_type: activityType as any,
          title: effectiveTitle,
          description: description.trim() || null,
          assigned_to: assignedTo && assignedTo !== "none" ? assignedTo : null,
          priority,
          due_date: dueDate || null,
          scheduled_at: scheduledAt || null,
          campaign_batch_id: batchId,
          source_meta: {
            company_name: partnerNames?.[pid] || null,
            ...(extraSourceMeta?.[pid] || {}),
          },
        }));

        await createActivities.mutateAsync(activities);
        done += chunk.length;
        setProgress({ done, total: partnerIds.length });
      }

      toast.success(`${partnerIds.length} attività create`);
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error("Errore nella creazione");
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setActivityType("follow_up");
    setAssignedTo("");
    setPriority("medium");
    setDueDate("");
    setScheduledAt("");
    setUseCampaignBatch(false);
    setCampaignBatchId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Crea Attività ({partnerIds.length} partner)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Activity type selector */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Tipo attività</Label>
            <Tabs value={activityType} onValueChange={(v) => setActivityType(v as ActivityTypeValue)}>
              <TabsList className="w-full grid grid-cols-5 h-9">
                {activityTypes.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="text-xs gap-1 px-1">
                    <t.icon className="w-3 h-3" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Titolo</Label>
            <Input
              placeholder={autoTitle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" /> Descrizione (opzionale)
            </Label>
            <Textarea
              placeholder="Note o istruzioni per questa attività..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[60px] text-sm"
            />
          </div>

          {/* Priority + Assignment row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Flag className="w-3 h-3" /> Priorità
              </Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className={p.color}>{p.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <UserCheck className="w-3 h-3" /> Assegna a
              </Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Nessuno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuno</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3 h-3" /> Scadenza
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="w-3 h-3" /> Programmata
              </Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {/* Campaign batch toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
            <div>
              <p className="text-sm font-medium">Raggruppa come campagna</p>
              <p className="text-[10px] text-muted-foreground">Le attività saranno collegate da un batch ID per il monitoraggio</p>
            </div>
            <Switch checked={useCampaignBatch} onCheckedChange={setUseCampaignBatch} />
          </div>

          {useCampaignBatch && (
            <Input
              placeholder="ID campagna (auto-generato se vuoto)"
              value={campaignBatchId}
              onChange={(e) => setCampaignBatchId(e.target.value)}
              className="h-9 text-sm font-mono"
            />
          )}

          {/* Partner preview */}
          {partnerNames && Object.keys(partnerNames).length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Partner selezionati</Label>
              <ScrollArea className="h-[80px] border rounded-md p-2">
                <div className="flex flex-wrap gap-1">
                  {partnerIds.slice(0, 30).map((id) => (
                    <Badge key={id} variant="secondary" className="text-[10px]">
                      {partnerNames[id] || id.slice(0, 8)}
                    </Badge>
                  ))}
                  {partnerIds.length > 30 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{partnerIds.length - 30} altri
                    </Badge>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Progress */}
          {creating && (
            <div className="space-y-1.5">
              <Progress value={(progress.done / progress.total) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {progress.done}/{progress.total} create
              </p>
            </div>
          )}

          {/* Submit */}
          <Button onClick={handleSubmit} disabled={creating} className="w-full">
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creazione {progress.done}/{progress.total}...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Crea {partnerIds.length} Attività
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

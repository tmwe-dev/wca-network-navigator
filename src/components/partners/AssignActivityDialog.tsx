import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useCreateActivities } from "@/hooks/useActivities";
import { toast } from "sonner";
import {
  Mail, Phone, CalendarClock, Users, Loader2, CheckCircle2,
  ClipboardList, Calendar, MessageSquare, AlertTriangle, XCircle,
} from "lucide-react";

export interface PartnerContactInfo {
  id: string;
  name: string;
  hasEmail: boolean;
  hasPhone: boolean;
}

interface AssignActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerIds: string[];
  partnerNames?: Record<string, string>;
  /** Contact availability per partner */
  partnerContactInfo?: PartnerContactInfo[];
  onSuccess: () => void;
  sourceType?: "partner" | "prospect" | "contact";
  extraSourceMeta?: Record<string, Record<string, unknown>>;
}

type ActivityTypeValue = "send_email" | "phone_call" | "meeting" | "follow_up" | "other";

const activityTypes = [
  { value: "send_email" as const, label: "Email", icon: Mail, requires: "email" as const },
  { value: "phone_call" as const, label: "Telefonata", icon: Phone, requires: "phone" as const },
  { value: "meeting" as const, label: "Meeting", icon: Users, requires: null },
  { value: "follow_up" as const, label: "Follow-up", icon: CalendarClock, requires: null },
  { value: "other" as const, label: "Altro", icon: ClipboardList, requires: null },
];

export function AssignActivityDialog({
  open, onOpenChange, partnerIds, partnerNames, partnerContactInfo,
  onSuccess, sourceType = "partner", extraSourceMeta,
}: AssignActivityDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activityType, setActivityType] = useState<ActivityTypeValue>("follow_up");
  const [dueDate, setDueDate] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [useCampaignBatch, setUseCampaignBatch] = useState(false);
  const [campaignBatchId, setCampaignBatchId] = useState("");
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const createActivities = useCreateActivities();

  const autoTitle = useMemo(() => {
    const typeLabel = activityTypes.find(t => t.value === activityType)?.label || "";
    return `${typeLabel} — ${new Date().toLocaleDateString("it-IT")}`;
  }, [activityType]);

  const effectiveTitle = title.trim() || autoTitle;
  const batchId = useCampaignBatch
    ? (campaignBatchId.trim() || `batch_${Date.now()}`)
    : null;

  // Compute valid/rejected based on activity type requirements
  const { validIds, rejectedPartners } = useMemo(() => {
    const typeDef = activityTypes.find(t => t.value === activityType);
    const requirement = typeDef?.requires;

    if (!requirement || !partnerContactInfo?.length) {
      return { validIds: partnerIds, rejectedPartners: [] as PartnerContactInfo[] };
    }

    const valid: string[] = [];
    const rejected: PartnerContactInfo[] = [];

    for (const id of partnerIds) {
      const info = partnerContactInfo.find(p => p.id === id);
      if (!info) {
        // No info available, assume valid
        valid.push(id);
        continue;
      }
      if (requirement === "email" && !info.hasEmail) {
        rejected.push(info);
      } else if (requirement === "phone" && !info.hasPhone) {
        rejected.push(info);
      } else {
        valid.push(id);
      }
    }

    return { validIds: valid, rejectedPartners: rejected };
  }, [activityType, partnerIds, partnerContactInfo]);

  const requirementLabel = activityType === "send_email" ? "email" : activityType === "phone_call" ? "telefono" : null;

  const handleSubmit = async () => {
    if (validIds.length === 0) {
      toast.error("Nessun partner valido per questo tipo di attività");
      return;
    }

    setCreating(true);
    setProgress({ done: 0, total: validIds.length });

    try {
      const CHUNK = 50;
      let done = 0;

      for (let i = 0; i < validIds.length; i += CHUNK) {
        const chunk = validIds.slice(i, i + CHUNK);
        const activities = chunk.map((pid) => ({
          partner_id: sourceType === "partner" ? pid : null,
          source_type: sourceType,
          source_id: pid,
          activity_type: activityType as typeof activityType,
          title: effectiveTitle,
          description: description.trim() || null,
          priority: "medium",
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
        setProgress({ done, total: validIds.length });
      }

      const rejectedMsg = rejectedPartners.length > 0
        ? ` (${rejectedPartners.length} esclusi per mancanza ${requirementLabel})`
        : "";
      toast.success(`${validIds.length} attività create${rejectedMsg}`);
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (_err) {
      toast.error("Errore nella creazione");
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setActivityType("follow_up");
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

          {/* Validation warning */}
          {rejectedPartners.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium">
                  {rejectedPartners.length} partner senza {requirementLabel}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Questi partner verranno esclusi dalla creazione. 
                {validIds.length > 0
                  ? ` Verranno create attività solo per i ${validIds.length} partner validi.`
                  : " Nessun partner valido per questo tipo di attività."}
              </p>
              <ScrollArea className="max-h-[100px]">
                <div className="flex flex-wrap gap-1">
                  {rejectedPartners.map((p) => (
                    <Badge key={p.id} variant="outline" className="text-[10px] gap-1 border-destructive/30 text-destructive">
                      <XCircle className="w-2.5 h-2.5" />
                      {p.name}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

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

          {/* Valid partner preview */}
          {partnerNames && validIds.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                {validIds.length} partner validi
              </Label>
              <ScrollArea className="h-[80px] border rounded-md p-2">
                <div className="flex flex-wrap gap-1">
                  {validIds.slice(0, 30).map((id) => (
                    <Badge key={id} variant="secondary" className="text-[10px]">
                      {partnerNames[id] || id.slice(0, 8)}
                    </Badge>
                  ))}
                  {validIds.length > 30 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{validIds.length - 30} altri
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
          <Button onClick={handleSubmit} disabled={creating || validIds.length === 0} className="w-full">
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creazione {progress.done}/{progress.total}...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Crea {validIds.length} Attività
                {rejectedPartners.length > 0 && (
                  <span className="ml-1 text-destructive-foreground/70">
                    ({rejectedPartners.length} esclusi)
                  </span>
                )}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

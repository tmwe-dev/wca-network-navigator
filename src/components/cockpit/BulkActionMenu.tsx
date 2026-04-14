import { useState } from "react";
import { format } from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CheckCircle2, StickyNote, CalendarClock,
  Phone, Users, MoreHorizontal, CalendarIcon, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAssignClient } from "@/hooks/useClientAssignments";
import { useAgents } from "@/hooks/useAgents";
import type { CockpitContact } from "@/hooks/useCockpitContacts";
import type { Database } from "@/integrations/supabase/types";
import { createLogger } from "@/lib/log";
import { insertActivity } from "@/data/activities";
import { deleteCockpitQueueItem } from "@/data/cockpitQueue";

const log = createLogger("BulkActionMenu");

type ActivityType = Database["public"]["Enums"]["activity_type"];

const DONE_TYPES: { type: ActivityType; label: string; icon: typeof Phone }[] = [
  { type: "phone_call", label: "Telefonata", icon: Phone },
  { type: "meeting", label: "Meeting", icon: Users },
  { type: "other", label: "Altro", icon: MoreHorizontal },
];

interface Props {
  selectedContacts: CockpitContact[];
  onComplete: () => void;
}

export function BulkActionMenu({ selectedContacts, onComplete }: Props) {
  const qc = useQueryClient();
  const assignClient = useAssignClient();
  const { agents } = useAgents();
  const [noteOpen, setNoteOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleNote, setScheduleNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const autoAssignBulk = async (contacts: CockpitContact[]) => {
    const salesAgent = agents.find(a => a.is_active && (a.role === "sales" || a.role === "outreach"))
      || agents.find(a => a.is_active);
    if (!salesAgent) return;
    for (const c of contacts) {
      const sourceType = c.sourceType === "partner_contact" ? "partner" : c.sourceType === "prospect_contact" ? "prospect" : "contact";
      try {
        await assignClient.mutateAsync({ sourceId: c.partnerId || c.sourceId, sourceType, agentId: salesAgent.id });
      } catch (e) { log.debug("fallback used", { error: e instanceof Error ? e.message : String(e) }); /* skip already assigned */ }
    }
  };

  const createBulkActivities = async (
    activityType: ActivityType,
    status: "completed" | "pending",
    extra: { due_date?: string; description?: string; completed_at?: string } = {}
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsProcessing(true);
    let successCount = 0;

    for (const contact of selectedContacts) {
      await insertActivity({
        user_id: user.id,
        activity_type: activityType,
        status,
        title: `${contact.name} — ${contact.company}`,
        source_type: contact.sourceType === "partner_contact" ? "partner" : contact.sourceType === "prospect_contact" ? "prospect" : "contact",
        source_id: contact.partnerId || contact.sourceId,
        source_meta: { company: contact.company, email: contact.email, country: contact.country, name: contact.name },
        partner_id: contact.partnerId,
        ...extra,
      } as Parameters<typeof supabase.from>[0]);

      successCount++;
      if (status === "completed" || extra.due_date) {
        await deleteCockpitQueueItem(contact.queueId);
      }
    }

    setIsProcessing(false);
    qc.invalidateQueries({ queryKey: ["cockpit-queue"] });
    qc.invalidateQueries({ queryKey: ["activities"] });
    qc.invalidateQueries({ queryKey: ["worked-today"] });
    return successCount;
  };

  const handleBulkMarkDone = async (type: ActivityType) => {
    const count = await createBulkActivities(type, "completed", { completed_at: new Date().toISOString() });
    await autoAssignBulk(selectedContacts);
    toast.success(`${count} attività completate`);
    onComplete();
  };

  const handleBulkNote = async () => {
    if (!noteText.trim()) return;
    const count = await createBulkActivities("other", "completed", {
      description: noteText,
      completed_at: new Date().toISOString(),
    });
    await autoAssignBulk(selectedContacts);
    toast.success(`Nota salvata su ${count} contatti`);
    setNoteText("");
    setNoteOpen(false);
    onComplete();
  };

  const handleBulkSchedule = async () => {
    if (!scheduleDate) return;
    const count = await createBulkActivities("follow_up", "pending", {
      due_date: format(scheduleDate, "yyyy-MM-dd"),
      description: scheduleNote || undefined,
    });
    await autoAssignBulk(selectedContacts);
    toast.success(`${count} contatti programmati per ${format(scheduleDate, "dd/MM/yyyy")}`);
    setScheduleDate(undefined);
    setScheduleNote("");
    setScheduleOpen(false);
    onComplete();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" disabled={isProcessing}>
            <Zap className="w-3 h-3" />
            {isProcessing ? "..." : "Azioni"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              Segna come svolta
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {DONE_TYPES.map(dt => (
                <DropdownMenuItem key={dt.type} className="gap-2 text-xs" onClick={() => handleBulkMarkDone(dt.type)}>
                  <dt.icon className="w-3.5 h-3.5" />
                  {dt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem className="gap-2 text-xs" onClick={() => setNoteOpen(true)}>
            <StickyNote className="w-3.5 h-3.5 text-amber-500" />
            Aggiungi nota
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 text-xs" onClick={() => setScheduleOpen(true)}>
            <CalendarClock className="w-3.5 h-3.5 text-blue-500" />
            Programma
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Bulk Note Dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Nota per {selectedContacts.length} contatti</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Scrivi una nota per tutti i contatti selezionati..."
            className="min-h-[100px] text-sm"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNoteOpen(false)}>Annulla</Button>
            <Button size="sm" onClick={handleBulkNote} disabled={!noteText.trim() || isProcessing}>
              {isProcessing ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Schedule Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Programma {selectedContacts.length} contatti</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left text-sm", !scheduleDate && "text-muted-foreground")}>
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {scheduleDate ? format(scheduleDate, "dd/MM/yyyy") : "Seleziona data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduleDate}
                  onSelect={setScheduleDate}
                  disabled={(date) => date < new Date()}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Textarea
              value={scheduleNote}
              onChange={e => setScheduleNote(e.target.value)}
              placeholder="Nota opzionale..."
              className="min-h-[60px] text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setScheduleOpen(false)}>Annulla</Button>
            <Button size="sm" onClick={handleBulkSchedule} disabled={!scheduleDate || isProcessing}>
              {isProcessing ? "..." : "Programma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

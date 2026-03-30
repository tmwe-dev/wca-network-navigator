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
  MoreVertical, CheckCircle2, StickyNote, CalendarClock,
  Phone, Users, MoreHorizontal, CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CockpitContact } from "@/hooks/useCockpitContacts";
import type { Database } from "@/integrations/supabase/types";

type ActivityType = Database["public"]["Enums"]["activity_type"];

const DONE_TYPES: { type: ActivityType; label: string; icon: typeof Phone }[] = [
  { type: "phone_call", label: "Telefonata", icon: Phone },
  { type: "meeting", label: "Meeting", icon: Users },
  { type: "other", label: "Altro", icon: MoreHorizontal },
];

interface Props {
  contact: CockpitContact;
  children?: React.ReactNode;
}

export function ContactActionMenu({ contact, children }: Props) {
  const qc = useQueryClient();
  const [noteOpen, setNoteOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleNote, setScheduleNote] = useState("");

  const createActivity = async (
    activityType: ActivityType,
    status: "completed" | "pending",
    extra: { due_date?: string; description?: string; completed_at?: string } = {}
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("activities").insert({
      user_id: user.id,
      activity_type: activityType,
      status,
      title: `${contact.name} — ${contact.company}`,
      source_type: contact.sourceType === "partner_contact" ? "partner" : contact.sourceType === "prospect_contact" ? "prospect" : "contact",
      source_id: contact.partnerId || contact.sourceId,
      source_meta: { company: contact.company, email: contact.email, country: contact.country, name: contact.name },
      partner_id: contact.partnerId,
      ...extra,
    } as any);

    if (error) {
      toast.error("Errore creazione attività");
      return;
    }

    // Remove from cockpit queue if completed or scheduled
    if (status === "completed" || extra.due_date) {
      await supabase.from("cockpit_queue").delete().eq("id", contact.queueId);
    }

    qc.invalidateQueries({ queryKey: ["cockpit-queue"] });
    qc.invalidateQueries({ queryKey: ["activities"] });
  };

  const handleMarkDone = async (type: ActivityType) => {
    await createActivity(type, "completed", { completed_at: new Date().toISOString() });
    toast.success(`${contact.name} — attività completata`);
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    await createActivity("other", "completed", {
      description: noteText,
      completed_at: new Date().toISOString(),
    });
    toast.success("Nota salvata");
    setNoteText("");
    setNoteOpen(false);
  };

  const handleSchedule = async () => {
    if (!scheduleDate) return;
    await createActivity("follow_up", "pending", {
      due_date: format(scheduleDate, "yyyy-MM-dd"),
      description: scheduleNote || undefined,
    });
    toast.success(`Programmata per ${format(scheduleDate, "dd/MM/yyyy")}`);
    setScheduleDate(undefined);
    setScheduleNote("");
    setScheduleOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {children || (
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              Segna come svolta
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {DONE_TYPES.map(dt => (
                <DropdownMenuItem key={dt.type} className="gap-2 text-xs" onClick={() => handleMarkDone(dt.type)}>
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

      {/* Note Dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Nota — {contact.name}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Scrivi una nota..."
            className="min-h-[100px] text-sm"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNoteOpen(false)}>Annulla</Button>
            <Button size="sm" onClick={handleSaveNote} disabled={!noteText.trim()}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Programma — {contact.name}</DialogTitle>
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
            <Button size="sm" onClick={handleSchedule} disabled={!scheduleDate}>Programma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { format } from "date-fns";
import { useDirectContactActions } from "@/hooks/useDirectContactActions";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MoreVertical, CheckCircle2, StickyNote, CalendarClock, Phone, Users, MoreHorizontal, CalendarIcon, Mail, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CockpitContact } from "@/hooks/useCockpitContacts";
import type { Database } from "@/integrations/supabase/types";
import { insertActivity } from "@/data/activities";
import { deleteCockpitQueueItem } from "@/data/cockpitQueue";
import { queryKeys } from "@/lib/queryKeys";

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
  const navigate = useAppNavigate();
  const qc = useQueryClient();
  const { handleSendWhatsApp: bridgeSendWhatsApp, waAvailable: _waAvailable } = useDirectContactActions();
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
    });

    if (status === "completed" || extra.due_date) {
      await deleteCockpitQueueItem(contact.queueId);
    }

    qc.invalidateQueries({ queryKey: queryKeys.cockpit.queue });
    qc.invalidateQueries({ queryKey: queryKeys.activities.all });
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

  const handleSendEmail = () => {
    navigate("/email-composer", {
      state: {
        partnerIds: contact.partnerId ? [contact.partnerId] : [],
        prefilledRecipient: {
          email: contact.email,
          name: contact.name,
          company: contact.company,
          partnerId: contact.partnerId,
          contactId: contact.sourceId,
        },
      },
    });
  };

  const handleSendWhatsApp = () => {
    const phone = contact.phone?.replace(/[^0-9+]/g, "");
    if (!phone) {
      toast.info("Numero di telefono non disponibile");
      return;
    }
    bridgeSendWhatsApp({
      phone,
      contactName: contact.name,
      companyName: contact.company,
      contactId: contact.sourceId,
      partnerId: contact.partnerId ?? undefined,
      sourceType: contact.sourceType === "partner_contact" ? "partner" : contact.sourceType === "prospect_contact" ? "prospect" : "contact",
      sourceId: contact.partnerId || contact.sourceId,
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {children || (
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md border border-border/50 bg-background/80 backdrop-blur-sm hover:bg-accent" aria-label="Altre azioni">
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {/* Communication group */}
          <DropdownMenuLabel className="text-[10px] text-muted-foreground/70 uppercase tracking-wider py-1">
            Comunicazione
          </DropdownMenuLabel>
          <DropdownMenuItem className="gap-2.5 text-xs px-3 py-2" onClick={handleSendEmail} disabled={!contact.email}>
            <Mail className="w-4 h-4 text-primary" />
            Invia email ora
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 text-xs px-3 py-2" onClick={handleSendWhatsApp} disabled={!contact.phone}>
            <MessageCircle className="w-4 h-4 text-emerald-500" />
            Invia WhatsApp
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Organization group */}
          <DropdownMenuLabel className="text-[10px] text-muted-foreground/70 uppercase tracking-wider py-1">
            Organizza
          </DropdownMenuLabel>
          <DropdownMenuItem className="gap-2.5 text-xs px-3 py-2" onClick={() => setNoteOpen(true)}>
            <StickyNote className="w-4 h-4 text-amber-500" />
            Aggiungi nota
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 text-xs px-3 py-2" onClick={() => setScheduleOpen(true)}>
            <CalendarClock className="w-4 h-4 text-blue-500" />
            Programma contatto
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Completion group */}
          <DropdownMenuLabel className="text-[10px] text-muted-foreground/70 uppercase tracking-wider py-1">
            Completa
          </DropdownMenuLabel>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2.5 text-xs px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Segna come svolta
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {DONE_TYPES.map(dt => (
                <DropdownMenuItem key={dt.type} className="gap-2.5 text-xs px-3 py-2" onClick={() => handleMarkDone(dt.type)}>
                  <dt.icon className="w-4 h-4" />
                  {dt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
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
            <DialogTitle className="text-sm">Programma contatto — {contact.name}</DialogTitle>
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

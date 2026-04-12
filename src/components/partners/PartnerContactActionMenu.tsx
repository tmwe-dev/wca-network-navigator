import { useState } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { format } from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MoreVertical, StickyNote, CalendarClock, Mail, MessageCircle,
  CheckCircle2, CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { insertActivity } from "@/data/activities";

interface PartnerContact {
  id: string;
  name?: string;
  email?: string;
  direct_phone?: string;
  mobile?: string;
  title?: string;
}

interface Props {
  contact: PartnerContact;
  partner: { id: string; company_name: string };
  onSendEmail?: (c: PartnerContact) => void;
  onSendWhatsApp?: (c: PartnerContact) => void;
  waAvailable?: boolean;
}

export function PartnerContactActionMenu({ contact, partner, onSendEmail, onSendWhatsApp, waAvailable }: Props) {
  const navigate = useAppNavigate();
  const qc = useQueryClient();
  const [noteOpen, setNoteOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleNote, setScheduleNote] = useState("");

  const hasPhone = !!(contact.mobile || contact.direct_phone);

  const createActivity = async (
    activityType: string,
    status: "completed" | "pending",
    extra: { due_date?: string; description?: string; completed_at?: string } = {}
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await insertActivity({
      user_id: user.id,
      activity_type: activityType,
      status,
      title: `${contact.name || "Contatto"} — ${partner.company_name}`,
      source_type: "partner",
      source_id: partner.id,
      partner_id: partner.id,
      selected_contact_id: contact.id,
      source_meta: { company: partner.company_name, email: contact.email, name: contact.name },
      ...extra,
    } as any);
    qc.invalidateQueries({ queryKey: ["activities"] });
  };

  const handleEmail = () => {
    if (onSendEmail) {
      onSendEmail(contact);
    } else {
      navigate("/email-composer", {
        state: {
          partnerIds: [partner.id],
          prefilledRecipient: {
            email: contact.email,
            name: contact.name,
            company: partner.company_name,
            partnerId: partner.id,
            contactId: contact.id,
          },
        },
      });
    }
  };

  const handleWhatsApp = () => {
    if (onSendWhatsApp) {
      onSendWhatsApp(contact);
    } else {
      const phone = (contact.mobile || contact.direct_phone || "").replace(/[^0-9+]/g, "");
      if (!phone) { toast.info("Numero non disponibile"); return; }
      // Fallback: open wa.me if no callback provided (bridge should be used via parent)
      window.open(`https://wa.me/${phone.replace("+", "")}`, "_blank");
    }
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

  const handleMarkDone = async () => {
    await createActivity("phone_call", "completed", { completed_at: new Date().toISOString() });
    toast.success(`${contact.name} — attività completata`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md opacity-60 hover:opacity-100 hover:bg-accent shrink-0">
            <MoreVertical className="w-3.5 h-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-[10px] text-muted-foreground/70 uppercase tracking-wider py-1">
            Comunicazione
          </DropdownMenuLabel>
          <DropdownMenuItem className="gap-2.5 text-xs px-3 py-2" onClick={handleEmail} disabled={!contact.email}>
            <Mail className="w-4 h-4 text-primary" />
            Invia email
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 text-xs px-3 py-2" onClick={handleWhatsApp} disabled={!hasPhone}>
            <MessageCircle className="w-4 h-4 text-emerald-500" />
            WhatsApp
          </DropdownMenuItem>

          <DropdownMenuSeparator />

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

          <DropdownMenuItem className="gap-2.5 text-xs px-3 py-2" onClick={handleMarkDone}>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Segna come svolta
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
                  className="p-3 pointer-events-auto"
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

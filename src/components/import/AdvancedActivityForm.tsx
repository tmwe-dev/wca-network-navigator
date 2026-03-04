import { useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, CalendarIcon, Clock, Users, Loader2, Send, Timer } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { ImportedContact } from "@/hooks/useImportLogs";

interface AdvancedActivityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ImportedContact[];
  onSubmit: (params: {
    activityType: "send_email" | "phone_call";
    priority: string;
    emailSubject?: string;
    emailBody?: string;
    description?: string;
    scheduledAt?: string;
    sendNow: boolean;
  }) => void;
  isSubmitting?: boolean;
}

export function AdvancedActivityForm({
  open,
  onOpenChange,
  contacts,
  onSubmit,
  isSubmitting,
}: AdvancedActivityFormProps) {
  const [activityTab, setActivityTab] = useState<"email" | "call">("email");
  const [priority, setPriority] = useState("medium");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [sendNow, setSendNow] = useState(true);

  const handleSubmit = useCallback(() => {
    let scheduledAt: string | undefined;
    if (!sendNow && scheduleDate) {
      const [h, m] = scheduleTime.split(":").map(Number);
      const d = new Date(scheduleDate);
      d.setHours(h, m, 0, 0);
      scheduledAt = d.toISOString();
    }

    onSubmit({
      activityType: activityTab === "email" ? "send_email" : "phone_call",
      priority,
      emailSubject: activityTab === "email" ? emailSubject : undefined,
      emailBody: activityTab === "email" ? emailBody : undefined,
      description: activityTab === "call" ? callNotes : undefined,
      scheduledAt,
      sendNow,
    });
  }, [activityTab, priority, emailSubject, emailBody, callNotes, scheduleDate, scheduleTime, sendNow, onSubmit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Crea Attività — {contacts.length} contatti
          </DialogTitle>
          <DialogDescription>
            Configura il tipo di attività e i dettagli per i contatti selezionati.
          </DialogDescription>
        </DialogHeader>

        {/* Selected contacts summary */}
        <ScrollArea className="max-h-[120px] border rounded-md p-2">
          <div className="flex flex-wrap gap-1.5">
            {contacts.slice(0, 50).map((c) => (
              <Badge key={c.id} variant="outline" className="text-[10px] px-1.5 py-0.5">
                {c.company_name || c.name || c.email || `#${c.row_number}`}
              </Badge>
            ))}
            {contacts.length > 50 && (
              <Badge variant="secondary" className="text-[10px]">
                +{contacts.length - 50} altri
              </Badge>
            )}
          </div>
        </ScrollArea>

        <Tabs value={activityTab} onValueChange={(v) => setActivityTab(v as "email" | "call")} className="flex-1">
          <TabsList className="w-full">
            <TabsTrigger value="email" className="flex-1">
              <Mail className="w-3.5 h-3.5 mr-1.5" />Email
            </TabsTrigger>
            <TabsTrigger value="call" className="flex-1">
              <Phone className="w-3.5 h-3.5 mr-1.5" />Chiamata
            </TabsTrigger>
          </TabsList>

          {/* EMAIL TAB */}
          <TabsContent value="email" className="space-y-3 mt-3">
            <div>
              <Label className="text-xs">Oggetto</Label>
              <Input
                placeholder="Oggetto email..."
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Corpo Email</Label>
              <Textarea
                placeholder="Scrivi il corpo dell'email..."
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="mt-1 min-h-[120px]"
              />
            </div>

            {/* Send now vs schedule */}
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant={sendNow ? "default" : "outline"}
                size="sm"
                onClick={() => setSendNow(true)}
              >
                <Send className="w-3.5 h-3.5 mr-1" />Invia subito
              </Button>
              <Button
                type="button"
                variant={!sendNow ? "default" : "outline"}
                size="sm"
                onClick={() => setSendNow(false)}
              >
                <Timer className="w-3.5 h-3.5 mr-1" />Programma
              </Button>
            </div>
          </TabsContent>

          {/* CALL TAB */}
          <TabsContent value="call" className="space-y-3 mt-3">
            <div>
              <Label className="text-xs">Note Chiamata</Label>
              <Textarea
                placeholder="Appunti per la chiamata..."
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                className="mt-1 min-h-[100px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={sendNow ? "default" : "outline"}
                size="sm"
                onClick={() => setSendNow(true)}
              >
                Adesso
              </Button>
              <Button
                type="button"
                variant={!sendNow ? "default" : "outline"}
                size="sm"
                onClick={() => setSendNow(false)}
              >
                <Timer className="w-3.5 h-3.5 mr-1" />Programma
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Schedule picker */}
        {!sendNow && (
          <div className="flex items-center gap-3 border rounded-md p-3 bg-muted/30">
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  {scheduleDate
                    ? format(scheduleDate, "dd MMM yyyy", { locale: it })
                    : "Seleziona data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduleDate}
                  onSelect={setScheduleDate}
                  locale={it}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-24 h-8 text-xs"
              />
            </div>
          </div>
        )}

        {/* Priority */}
        <div className="flex items-center gap-3">
          <Label className="text-xs whitespace-nowrap">Priorità</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Bassa</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : activityTab === "email" ? (
              <Mail className="w-4 h-4 mr-1.5" />
            ) : (
              <Phone className="w-4 h-4 mr-1.5" />
            )}
            Crea {contacts.length} Attività
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

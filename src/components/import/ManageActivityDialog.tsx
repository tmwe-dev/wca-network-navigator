import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Save, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Activity {
  id: string;
  title: string;
  activity_type: string;
  status: string;
  priority: string;
  description: string | null;
  due_date: string | null;
  email_subject: string | null;
  email_body: string | null;
  scheduled_at: string | null;
  created_at: string;
  completed_at: string | null;
}

interface ManageActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity | null;
}

export function ManageActivityDialog({
  open,
  onOpenChange,
  activity,
}: ManageActivityDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("pending");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [dueTime, setDueTime] = useState("09:00");

  useEffect(() => {
    if (activity) {
      setStatus(activity.status);
      setPriority(activity.priority);
      setDescription(activity.description || "");
      setEmailSubject(activity.email_subject || "");
      setEmailBody(activity.email_body || "");
      if (activity.due_date) {
        setDueDate(new Date(activity.due_date));
      } else {
        setDueDate(undefined);
      }
    }
  }, [activity]);

  const handleSave = useCallback(async () => {
    if (!activity) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        status,
        priority,
        description: description || null,
        email_subject: emailSubject || null,
        email_body: emailBody || null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      };

      if (status === "completed" && activity.status !== "completed") {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("activities")
        .update(updates)
        .eq("id", activity.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast({ title: "Attività aggiornata" });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Errore", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [activity, status, priority, description, emailSubject, emailBody, dueDate, queryClient, onOpenChange]);

  if (!activity) return null;

  const isEmail = activity.activity_type === "send_email";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base truncate">{activity.title}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1 text-xs">Dettagli</TabsTrigger>
            {isEmail && <TabsTrigger value="email" className="flex-1 text-xs">Email</TabsTrigger>}
            <TabsTrigger value="history" className="flex-1 text-xs">Info</TabsTrigger>
          </TabsList>

          {/* DETAILS TAB */}
          <TabsContent value="details" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Stato</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">In attesa</SelectItem>
                    <SelectItem value="in_progress">In corso</SelectItem>
                    <SelectItem value="completed">Completato</SelectItem>
                    <SelectItem value="cancelled">Annullato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Priorità</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Bassa</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Due date */}
            <div>
              <Label className="text-xs">Scadenza</Label>
              <div className="flex items-center gap-2 mt-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs">
                      <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                      {dueDate ? format(dueDate, "dd MMM yyyy", { locale: it }) : "Nessuna"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={it} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                {dueDate && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setDueDate(undefined)}>
                    Rimuovi
                  </Button>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs">Descrizione</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Note..."
                className="mt-1 min-h-[80px] text-xs"
              />
            </div>
          </TabsContent>

          {/* EMAIL TAB */}
          {isEmail && (
            <TabsContent value="email" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs">Oggetto</Label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Corpo</Label>
                <Textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="mt-1 min-h-[150px] text-xs"
                />
              </div>
            </TabsContent>
          )}

          {/* HISTORY TAB */}
          <TabsContent value="history" className="space-y-2 mt-3 text-xs">
            <div className="space-y-1.5 text-muted-foreground">
              <div>Creata: {format(new Date(activity.created_at), "dd/MM/yyyy HH:mm", { locale: it })}</div>
              {activity.completed_at && (
                <div>Completata: {format(new Date(activity.completed_at), "dd/MM/yyyy HH:mm", { locale: it })}</div>
              )}
              {activity.scheduled_at && (
                <div>Programmata: {format(new Date(activity.scheduled_at), "dd/MM/yyyy HH:mm", { locale: it })}</div>
              )}
              <div>Tipo: <Badge variant="outline" className="text-[9px]">{activity.activity_type}</Badge></div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

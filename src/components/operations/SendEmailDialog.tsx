import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "sonner";
import { useTrackActivity } from "@/hooks/useTrackActivity";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientEmail: string;
  recipientName: string;
  companyName: string;
  partnerId: string;
  isDark: boolean;
}

export function SendEmailDialog({
  open, onOpenChange, recipientEmail, recipientName, companyName, partnerId, _isDark,
}: SendEmailDialogProps) {
  const [subject, setSubject] = useState(`Contatto da ${companyName}`);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const trackActivity = useTrackActivity();
  const handleSend = async () => {
    if (!body.trim()) {
      toast.error("Scrivi un messaggio prima di inviare");
      return;
    }
    setSending(true);
    try {
      const html = body.replace(/\n/g, "<br/>");
      const data = await invokeEdge<any>("send-email", { body: { to: recipientEmail, subject, html, partner_id: partnerId }, context: "SendEmailDialog.send_email" });
      if (data?.error) throw new Error(data.error);
      toast.success(`Email inviata a ${recipientEmail}`);
      trackActivity.mutate({
        activityType: "send_email",
        title: `${companyName || "—"} — ${recipientName || recipientEmail}`,
        sourceId: partnerId,
        sourceType: "partner",
        partnerId,
        emailSubject: subject,
        description: `Email inviata a ${recipientEmail}`,
      });
      onOpenChange(false);
      setBody("");
    } catch (e: any) {
      toast.error(e?.message || "Errore nell'invio dell'email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4" /> Invia Email
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">A</Label>
            <Input value={`${recipientName} <${recipientEmail}>`} readOnly className="text-sm opacity-70" />
          </div>
          <div>
            <Label className="text-xs">Oggetto</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} className="text-sm" />
          </div>
          <div>
            <Label className="text-xs">Messaggio</Label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Scrivi il messaggio..."
              rows={6}
              className="text-sm resize-none"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Annulla
          </Button>
          <Button onClick={handleSend} disabled={sending || !body.trim()}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            Invia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

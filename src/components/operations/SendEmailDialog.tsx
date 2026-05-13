import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useEnqueueAction } from "@/hooks/useEnqueueAction";
// SSOT v3.9.56: invio email passa da ai_pending_actions → approvazione manuale

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
  open, onOpenChange, recipientEmail, recipientName, companyName, partnerId, isDark: _isDark,
}: SendEmailDialogProps) {
  const [subject, setSubject] = useState(`Contatto da ${companyName}`);
  const [body, setBody] = useState("");
  const { enqueue, enqueuing } = useEnqueueAction();
  const sending = enqueuing;
  const handleSend = async () => {
    if (!body.trim()) {
      toast.error("Scrivi un messaggio prima di inviare");
      return;
    }
    const html = body.replace(/\n/g, "<br/>");
    const res = await enqueue({
      action_type: "send_email",
      payload: { to: recipientEmail, subject, html, body, partner_id: partnerId },
      partner_id: partnerId,
      email_address: recipientEmail,
      suggested_content: body,
      reasoning: `Email manuale da SendEmailDialog a ${recipientName}.`,
      source: "SendEmailDialog",
      decision_origin: "user_manual",
    });
    if (res.ok) {
      onOpenChange(false);
      setBody("");
    } else {
      toast.error(res.error || "Errore in coda");
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

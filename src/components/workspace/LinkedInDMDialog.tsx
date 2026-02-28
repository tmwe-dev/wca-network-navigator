import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { toast } from "@/hooks/use-toast";

interface LinkedInDMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileUrl: string;
  contactName: string | null;
  companyName: string;
}

export default function LinkedInDMDialog({
  open, onOpenChange, profileUrl, contactName, companyName,
}: LinkedInDMDialogProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { isAvailable, sendDirectMessage } = useLinkedInExtensionBridge();

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await sendDirectMessage(profileUrl, message.trim());
      if (res.success) {
        toast({ title: "Messaggio LinkedIn inviato!" });
        setMessage("");
        onOpenChange(false);
      } else {
        toast({ title: "Errore invio", description: res.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Errore", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Send className="w-4 h-4 text-[#0A66C2]" />
            Messaggio LinkedIn
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{contactName || companyName}</span>
            {contactName && companyName && (
              <span> · {companyName}</span>
            )}
          </div>

          {!isAvailable && (
            <div className="text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
              ⚠️ Estensione LinkedIn non rilevata. Installa e attiva l'estensione per inviare messaggi.
            </div>
          )}

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Scrivi il tuo messaggio..."
            rows={5}
            className="resize-none"
          />

          <p className="text-[10px] text-muted-foreground">
            Il messaggio verrà inviato tramite l'estensione LinkedIn. Assicurati di essere connesso.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            Annulla
          </Button>
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sending || !isAvailable}
            size="sm"
            className="bg-[#0A66C2] hover:bg-[#004182] text-white gap-1.5"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Invia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

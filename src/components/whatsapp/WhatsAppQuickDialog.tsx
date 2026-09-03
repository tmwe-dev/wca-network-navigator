/**
 * WhatsAppQuickDialog — scrivi subito un messaggio WhatsApp a un numero,
 * anche se non esiste una conversazione pregressa.
 *
 * Invio phone-first via SSOT `sendWhatsAppDirect` (chat manuale aperta dall'utente).
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { sendWhatsAppDirect } from "@/lib/messaging/whatsappSender";
import { useWhatsAppQuickState, closeWhatsAppQuick } from "./whatsappQuickStore";

function normalize(phone: string): string {
  return (phone || "").replace(/[\s\-().]/g, "").replace(/^\+/, "");
}

export default function WhatsAppQuickDialog() {
  const { open, target } = useWhatsAppQuickState();
  const { isAvailable, isAuthenticated, sendWhatsApp } = useWhatsAppExtensionBridge();
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setPhone(normalize(target?.phone ?? ""));
      setText(target?.initialMessage ?? "");
    }
  }, [open, target]);

  const cleanPhone = normalize(phone);
  const phoneValid = cleanPhone.length >= 8 && /^\d+$/.test(cleanPhone);

  const handleSend = async () => {
    if (!phoneValid) {
      toast.error("Numero non valido. Usa il formato internazionale (es. 39333...).");
      return;
    }
    if (!text.trim()) {
      toast.error("Scrivi un messaggio.");
      return;
    }
    if (!isAvailable) {
      toast.error("Estensione WhatsApp non rilevata. Apri WhatsApp Web e ricarica la pagina.");
      return;
    }
    if (!isAuthenticated) {
      toast.error("WhatsApp Web non autenticato. Scansiona il QR code.");
      return;
    }

    setSending(true);
    try {
      const res = await sendWhatsAppDirect({
        phone: cleanPhone,
        text: text.trim(),
        partnerId: target?.partnerId ?? undefined,
        contactId: target?.contactId ?? undefined,
        source: "whatsapp-quick-dialog",
        bridgeSender: sendWhatsApp,
      });
      if (res.success) {
        toast.success(`Messaggio inviato a ${target?.contactName || cleanPhone}`);
        closeWhatsAppQuick();
      } else {
        toast.error(res.error || "Invio fallito");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore invio WhatsApp");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? closeWhatsAppQuick() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            WhatsApp a {target?.contactName || "contatto"}
          </DialogTitle>
          <DialogDescription>
            {target?.companyName ? `${target.companyName} · ` : ""}
            Invio diretto al numero, anche senza conversazione precedente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="wa-quick-phone">Numero (formato internazionale, senza +)</Label>
            <Input
              id="wa-quick-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="393331234567"
              inputMode="tel"
            />
            {!phoneValid && phone.length > 0 && (
              <p className="text-xs text-destructive">Numero non valido: servono almeno 8 cifre, prefisso incluso.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-quick-text">Messaggio</Label>
            <Textarea
              id="wa-quick-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="Scrivi il messaggio…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleSend();
              }}
            />
          </div>
          {!isAvailable && (
            <p className="text-xs text-muted-foreground">
              Estensione non rilevata: apri WhatsApp Web in una scheda e ricarica l&apos;app.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={closeWhatsAppQuick} disabled={sending}>
            Annulla
          </Button>
          <Button onClick={() => void handleSend()} disabled={sending || !phoneValid || !text.trim()}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Invia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Search, ExternalLink, Linkedin, CheckCircle2 } from "lucide-react";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useLinkedInLookup } from "@/hooks/useLinkedInLookup";
import { isLinkedInProfileUrl, normalizeLinkedInProfileUrl } from "@/lib/linkedinSearch";
import { toast } from "@/hooks/use-toast";
import { createLogger } from "@/lib/log";
import { insertPartnerSocialLink, findSocialLinksByPartnerIds } from "@/data/partnerRelations";
import { updateContactEnrichment } from "@/data/contacts";

const log = createLogger("LinkedInDMDialog");

interface LinkedInDMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileUrl: string;
  contactName: string | null;
  companyName: string;
  contactId?: string;
  partnerId?: string;
  contactEmail?: string | null;
  initialMessage?: string;
}

export default function LinkedInDMDialog({
  open, onOpenChange, profileUrl, contactName, companyName, contactId, partnerId, contactEmail, initialMessage,
}: LinkedInDMDialogProps) {
  const [message, setMessage] = useState(initialMessage || "");
  const [url, setUrl] = useState(profileUrl || "");
  const [sending, setSending] = useState(false);
  const lastSavedUrlRef = useRef<string | null>(null);
  const { isAvailable, sendDirectMessage } = useLinkedInExtensionBridge();
  const lookup = useLinkedInLookup();

  useEffect(() => {
    setUrl(profileUrl || "");
    lastSavedUrlRef.current = profileUrl || null;
  }, [profileUrl, open]);

  const normalized = normalizeLinkedInProfileUrl(url);
  const urlValid = !!normalized;
  const remaining = 300 - message.length;
  const hadInitialUrl = !!normalizeLinkedInProfileUrl(profileUrl);

  // Auto-save URL trovato/incollato (solo se valido e diverso dall'iniziale)
  const persistUrl = async (newUrl: string) => {
    if (!newUrl || lastSavedUrlRef.current === newUrl) return;
    try {
      if (partnerId) {
        const existing = await findSocialLinksByPartnerIds([partnerId], "linkedin");
        if (!existing.some(l => l.url === newUrl)) {
          await insertPartnerSocialLink({ partner_id: partnerId, contact_id: null, platform: "linkedin", url: newUrl });
        }
      } else if (contactId) {
        await updateContactEnrichment(contactId, { linkedin_profile_url: newUrl });
      }
      lastSavedUrlRef.current = newUrl;
    } catch (e) {
      log.warn("auto-save url failed", { error: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleLiveSearch = async () => {
    if (!contactName?.trim() && !companyName?.trim()) {
      toast({ title: "Manca nome o azienda per la ricerca", variant: "destructive" });
      return;
    }
    const res = await lookup.searchSingle({
      name: contactName || companyName,
      company: companyName,
      email: contactEmail,
      sourceType: contactId ? "contact" : undefined,
      sourceId: contactId,
    });
    if (res.url) {
      setUrl(res.url);
      void persistUrl(res.url);
      toast({ title: "✅ Profilo trovato e salvato", description: res.url });
    } else {
      const q = `site:linkedin.com/in "${contactName || companyName}"${companyName && contactName ? ` "${companyName}"` : ""}`;
      toast({
        title: "Nessun match automatico",
        description: "Apro Google: copia l'URL del profilo qui sotto.",
      });
      window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, "_blank");
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    if (!urlValid) {
      toast({ title: "URL profilo LinkedIn non valido", description: "Formato richiesto: linkedin.com/in/...", variant: "destructive" });
      return;
    }
    // Salva URL se modificato manualmente prima dell'invio
    if (normalized && normalized !== lastSavedUrlRef.current) {
      await persistUrl(normalized);
    }
    setSending(true);
    try {
      const res = await sendDirectMessage(normalized!, message.trim());
      if (res.success) {
        toast({ title: "Messaggio LinkedIn inviato!" });
        setMessage("");
        onOpenChange(false);
      } else {
        toast({ title: "Errore invio", description: res.error, variant: "destructive" });
      }
    } catch (e) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
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
            {contactName && companyName && (<span> · {companyName}</span>)}
          </div>

          {!isAvailable && (
            <div className="text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
              ⚠️ Estensione LinkedIn non rilevata. Installa e attiva l'estensione per inviare messaggi.
            </div>
          )}

          {/* URL profilo LinkedIn (obbligatorio) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium flex items-center gap-1">
                <Linkedin className="w-3 h-3 text-[#0A66C2]" />
                URL profilo LinkedIn
              </label>
              <div className="flex gap-1">
                <Button
                  type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1"
                  onClick={handleLiveSearch}
                  disabled={lookup.isSearching}
                  title="Ricerca live profilo LinkedIn"
                >
                  {lookup.isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  Cerca
                </Button>
                {urlValid && (
                  <Button
                    type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1"
                    onClick={() => window.open(normalized!, "_blank")}
                    title="Apri profilo in nuova scheda"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://linkedin.com/in/..."
              className={`h-8 text-xs ${url && !urlValid ? "border-destructive" : ""}`}
            />
            {url && !urlValid && (
              <p className="text-[10px] text-destructive">Formato non valido. Atteso: linkedin.com/in/nome-cognome</p>
            )}
          </div>

          <div className="space-y-1">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 300))}
              placeholder="Scrivi il tuo messaggio..."
              rows={5}
              className="resize-none"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Max 300 caratteri (limite LinkedIn)</span>
              <span className={remaining < 30 ? "text-warning" : ""}>{remaining}</span>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Il messaggio verrà inviato tramite l'estensione LinkedIn. Max 3/ora per evitare blocchi.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">Annulla</Button>
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sending || !isAvailable || !urlValid}
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

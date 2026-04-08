import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import DOMPurify from "dompurify";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useFireScrapeExtensionBridge } from "@/hooks/useFireScrapeExtensionBridge";
import type { DraftState } from "@/pages/Cockpit";
import { useTrackActivity } from "@/hooks/useTrackActivity";
export function useAIDraftActions(draft: DraftState, onDraftChange: (d: DraftState) => void) {
  const [sending, setSending] = useState(false);
  const [liDmOpen, setLiDmOpen] = useState(false);
  const waBridge = useWhatsAppExtensionBridge();
  const liBridge = useLinkedInExtensionBridge();
  const pcBridge = useFireScrapeExtensionBridge();
  const trackActivity = useTrackActivity();
  const handleCopy = () => {
    const text = draft.channel === "email"
      ? `Subject: ${draft.subject}\n\n${draft.body.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?[^>]+(>|$)/g, "")}`
      : draft.body;
    navigator.clipboard.writeText(text);
    toast({ title: "Copiato negli appunti" });
  };

  const handleSendWhatsApp = async () => {
    const phone = draft.contactPhone?.replace(/[^0-9+]/g, "").replace(/^\+/, "");
    if (!phone) {
      toast({ title: "Numero di telefono mancante", variant: "destructive" });
      return;
    }
    const plainText = draft.body.replace(/<[^>]+>/g, "").trim();

    if (waBridge.isAvailable) {
      setSending(true);
      try {
        const res = await waBridge.sendWhatsApp(phone, plainText);
        if (res.success) {
          toast({ title: "✅ WhatsApp inviato!", description: `A: ${phone}` });
        } else {
          toast({ title: "Errore WhatsApp", description: res.error, variant: "destructive" });
        }
      } catch {
        toast({ title: "Errore invio WhatsApp", variant: "destructive" });
      } finally {
        setSending(false);
      }
    } else {
      navigator.clipboard.writeText(plainText);
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(plainText)}`;
      toast({
        title: "📋 Messaggio copiato!",
        description: "Estensione WA non rilevata. Clicca per aprire WhatsApp.",
      });
      window.open(waUrl, "_blank");
    }
  };

  const findLinkedInProfile = async (): Promise<string> => {
    let profileUrl = draft.contactLinkedinUrl || "";
    if (!profileUrl && (pcBridge.isAvailable || liBridge.isAvailable) && draft.contactName) {
      toast({ title: "🔍 Cercando profilo LinkedIn...", description: `Ricerca per ${draft.contactName}` });
      const searchQuery = `${draft.contactName} ${draft.companyName || ""}`.trim();

      if (pcBridge.isAvailable) {
        const googleQuery = `site:linkedin.com/in "${draft.contactName}"${draft.companyName ? ` "${draft.companyName}"` : ""}`;
        const gRes = await pcBridge.googleSearch(googleQuery, 5);
        if (gRes.success && Array.isArray(gRes.data)) {
          for (const item of gRes.data) {
            if (item.url && /linkedin\.com\/(in|pub)\/[^/]+/.test(item.url)) {
              try {
                const parsed = new URL(item.url);
                profileUrl = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.replace(/\/$/, "");
              } catch {
                profileUrl = item.url.split("?")[0].replace(/\/$/, "");
              }
              break;
            }
          }
        }
      }

      if (!profileUrl && liBridge.isAvailable) {
        const res = await liBridge.searchProfile(searchQuery);
        if (res.success && res.profile?.profileUrl) {
          profileUrl = res.profile.profileUrl;
        }
      }

      if (profileUrl) {
        onDraftChange({ ...draft, contactLinkedinUrl: profileUrl });
        toast({ title: "✅ Profilo trovato!", description: profileUrl });
      }
    }
    return profileUrl;
  };

  const handleSendLinkedIn = async () => {
    const plainText = draft.body.replace(/<[^>]+>/g, "").trim();
    let profileUrl: string;
    try {
      profileUrl = await findLinkedInProfile();
    } catch {
      toast({ title: "Errore ricerca LinkedIn", variant: "destructive" });
      return;
    }

    if (!profileUrl) {
      toast({ title: "URL profilo LinkedIn mancante", variant: "destructive" });
      return;
    }

    if (liBridge.isAvailable) {
      setSending(true);
      try {
        const res = await liBridge.sendDirectMessage(profileUrl, plainText);
        if (res.success) {
          toast({ title: "✅ LinkedIn inviato!", description: `A: ${draft.contactName}` });
        } else {
          navigator.clipboard.writeText(plainText);
          toast({ title: "📋 Messaggio copiato", description: "Apri il profilo LinkedIn e incolla il messaggio." });
          if (profileUrl) window.open(profileUrl, "_blank");
        }
      } catch {
        navigator.clipboard.writeText(plainText);
        toast({ title: "📋 Messaggio copiato negli appunti", description: "Errore nell'invio automatico." });
        if (profileUrl) window.open(profileUrl, "_blank");
      } finally {
        setSending(false);
      }
    } else {
      if (profileUrl) {
        navigator.clipboard.writeText(plainText);
        toast({ title: "📋 Messaggio copiato!", description: "Apertura profilo LinkedIn..." });
        window.open(profileUrl, "_blank");
      } else {
        setLiDmOpen(true);
      }
    }
  };

  const handleSend = async () => {
    if (draft.channel !== "email" || !draft.contactEmail) {
      toast({ title: "Invio disponibile solo per email con indirizzo", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const sanitizedHtml = DOMPurify.sanitize(draft.body, {
        ALLOWED_TAGS: ['br', 'p', 'b', 'i', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'span', 'div'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'style'],
      });
      const data = await invokeEdge<{ error?: string }>("send-email", {
        body: { to: draft.contactEmail, subject: draft.subject, html: sanitizedHtml },
        context: "useAIDraftActions.sendEmail",
      });
      if (data?.error) throw new Error(data.error);
      toast({ title: "Email inviata!", description: `A: ${draft.contactEmail}` });
      trackActivity.mutate({
        activityType: "send_email",
        title: `${draft.companyName || "—"} — ${draft.contactName || draft.contactEmail}`,
        sourceId: draft.contactId || crypto.randomUUID(),
        sourceType: "imported_contact",
        emailSubject: draft.subject,
        description: `Email inviata a ${draft.contactEmail}`,
      });
    } catch (err: any) {
      toast({ title: "Errore invio", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleConnectLinkedIn = async () => {
    if (!liBridge.isAvailable) {
      toast({ title: "Estensione LinkedIn non rilevata", variant: "destructive" });
      return;
    }
    let url = draft.contactLinkedinUrl || "";
    if (!url && draft.contactName) {
      toast({ title: "🔍 Cercando profilo LinkedIn..." });
      try {
        url = await findLinkedInProfile();
      } catch {
        toast({ title: "Errore ricerca", variant: "destructive" });
        return;
      }
    }
    if (!url) {
      toast({ title: "URL profilo non trovato", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await liBridge.sendConnectionRequest(url, draft.body.replace(/<[^>]+>/g, "").trim().slice(0, 300));
      if (res.success) {
        toast({ title: "✅ Richiesta di collegamento inviata!" });
      } else {
        toast({ title: "Errore connessione", description: res.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Errore invio richiesta", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return {
    sending, liDmOpen, setLiDmOpen,
    waBridge, liBridge, pcBridge,
    handleCopy, handleSendWhatsApp, handleSendLinkedIn, handleSend, handleConnectLinkedIn,
  };
}

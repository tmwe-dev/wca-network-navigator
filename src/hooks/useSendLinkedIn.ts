/**
 * useSendLinkedIn — logica invio LinkedIn via bridge + ricerca profilo.
 * Scopo unico: inviare messaggi/connessioni LinkedIn con tracking (Documento 2 §2.4).
 */
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useFireScrapeExtensionBridge } from "@/hooks/useFireScrapeExtensionBridge";
import { useLogAction } from "@/hooks/useLogAction";
import { createLogger } from "@/lib/log";
import type { DraftState } from "@/types/cockpit";

const log = createLogger("useSendLinkedIn");

export function useSendLinkedIn(draft: DraftState, onDraftChange: (d: DraftState) => void) {
  const [sending, setSending] = useState(false);
  const [liDmOpen, setLiDmOpen] = useState(false);
  const liBridge = useLinkedInExtensionBridge();
  const pcBridge = useFireScrapeExtensionBridge();
  const logAction = useLogAction();

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
              } catch (e) {
                log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
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
    } catch (err: unknown) {
      log.error("LinkedIn profile search failed", { error: err instanceof Error ? err.message : String(err) });
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
          logAction.mutate({
            channel: "linkedin",
            sourceType: "imported_contact",
            sourceId: draft.contactId || crypto.randomUUID(),
            to: profileUrl,
            title: `${draft.companyName || "—"} — ${draft.contactName || "contatto"}`,
            subject: `LinkedIn DM a ${draft.contactName || "contatto"}`,
            body: plainText,
            source: "manual",
          });
        } else {
          navigator.clipboard.writeText(plainText);
          toast({ title: "📋 Messaggio copiato", description: "Apri il profilo LinkedIn e incolla il messaggio." });
          if (profileUrl) window.open(profileUrl, "_blank");
        }
      } catch (err: unknown) {
        log.warn("LinkedIn send fallback to clipboard", { error: err instanceof Error ? err.message : String(err) });
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
      } catch (err: unknown) {
        log.error("LinkedIn connect search failed", { error: err instanceof Error ? err.message : String(err) });
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
        logAction.mutate({
          channel: "linkedin",
          sourceType: "imported_contact",
          sourceId: draft.contactId || crypto.randomUUID(),
          to: url,
          title: `LinkedIn Connect — ${draft.contactName || "contatto"}`,
          subject: `Richiesta collegamento LinkedIn`,
          source: "manual",
          meta: { type: "connection_request" },
        });
      } else {
        toast({ title: "Errore connessione", description: res.error, variant: "destructive" });
      }
    } catch (err: unknown) {
      log.error("LinkedIn connect failed", { error: err instanceof Error ? err.message : String(err) });
      toast({ title: "Errore invio richiesta", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return { sending, liDmOpen, setLiDmOpen, liBridge, pcBridge, handleSendLinkedIn, handleConnectLinkedIn };
}

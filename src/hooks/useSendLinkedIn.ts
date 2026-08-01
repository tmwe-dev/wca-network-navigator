/**
 * useSendLinkedIn — logica invio LinkedIn via bridge + ricerca profilo.
 * Scopo unico: inviare messaggi/connessioni LinkedIn con tracking (Documento 2 §2.4).
 */
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useFireScrapeExtensionBridge } from "@/hooks/useFireScrapeExtensionBridge";
import { createLogger } from "@/lib/log";
import { useEnqueueAction } from "@/hooks/useEnqueueAction";
import type { DraftState } from "@/types/cockpit";

const log = createLogger("useSendLinkedIn");

/**
 * v3.9.56+ pipeline: ogni invio LinkedIn passa da `ai_pending_actions` →
 * approvazione manuale → `useApproveAndDispatch` → bridge `from-webapp-li`.
 * Nessun dispatch diretto qui.
 */
export function useSendLinkedIn(draft: DraftState, onDraftChange: (d: DraftState) => void) {
  const [sending, setSending] = useState(false);
  const [liDmOpen, setLiDmOpen] = useState(false);
  const liBridge = useLinkedInExtensionBridge();
  const pcBridge = useFireScrapeExtensionBridge();
  const { enqueue } = useEnqueueAction();

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
      if (!liBridge.isAvailable) {
        setLiDmOpen(true);
        return;
      }
      toast({ title: "URL profilo LinkedIn mancante", variant: "destructive" });
      return;
    }

    if (!plainText) {
      toast({ title: "Messaggio vuoto", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      await enqueue({
        action_type: "send_linkedin",
        partner_id: null,
        contact_id: draft.contactId ?? null,
        payload: {
          recipient: profileUrl,
          message_text: plainText.slice(0, 300),
          contact_id: draft.contactId ?? null,
          contactName: draft.contactName ?? null,
          companyName: draft.companyName ?? null,
        },
        suggested_content: plainText.slice(0, 300),
        reasoning: `LinkedIn DM manuale dal cockpit verso ${draft.contactName || profileUrl}.`,
        source: "cockpit",
        decision_origin: "user_manual",
      });
    } finally {
      setSending(false);
    }
  };

  const handleConnectLinkedIn = async () => {
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
      const note = draft.body.replace(/<[^>]+>/g, "").trim().slice(0, 300);
      await enqueue({
        action_type: "linkedin_connect",
        partner_id: null,
        contact_id: draft.contactId ?? null,
        payload: {
          recipient: url,
          message_text: note,
          contact_id: draft.contactId ?? null,
          contactName: draft.contactName ?? null,
          companyName: draft.companyName ?? null,
        },
        suggested_content: note,
        reasoning: `Richiesta di collegamento LinkedIn manuale verso ${draft.contactName || url}.`,
        source: "cockpit",
        decision_origin: "user_manual",
      });
    } finally {
      setSending(false);
    }
  };

  return { sending, liDmOpen, setLiDmOpen, liBridge, pcBridge, handleSendLinkedIn, handleConnectLinkedIn };
}

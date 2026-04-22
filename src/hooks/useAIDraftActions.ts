/**
 * useAIDraftActions — composizione dei 3 hook di invio canale.
 * Scopo unico: orchestrare le azioni draft (Documento 2 §2.4 "un solo scopo").
 */
import { toast } from "@/hooks/use-toast";
import type { DraftState } from "@/types/cockpit";
import { useSendWhatsApp } from "./useSendWhatsApp";
import { useSendLinkedIn } from "./useSendLinkedIn";
import { useSendEmail } from "./useSendEmail";

export function useAIDraftActions(draft: DraftState, onDraftChange: (d: DraftState) => void) {
  const wa = useSendWhatsApp(draft);
  const li = useSendLinkedIn(draft, onDraftChange);
  const email = useSendEmail(draft);

  const sending = wa.sending || li.sending || email.sending;

  const handleCopy = () => {
    const text = draft.channel === "email"
      ? `Subject: ${draft.subject}\n\n${draft.body.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?[^>]+(>|$)/g, "")}`
      : draft.body;
    navigator.clipboard.writeText(text);
    toast({ title: "Copiato negli appunti" });
  };

  return {
    sending,
    liDmOpen: li.liDmOpen,
    setLiDmOpen: li.setLiDmOpen,
    waBridge: wa.waBridge,
    liBridge: li.liBridge,
    pcBridge: li.pcBridge,
    handleCopy,
    handleSendWhatsApp: wa.handleSendWhatsApp,
    handleSendLinkedIn: li.handleSendLinkedIn,
    handleSend: email.handleSend,
    handleConnectLinkedIn: li.handleConnectLinkedIn,
  };
}

/**
 * LinkedIn Sender — SSOT per l'invio LinkedIn dalla web app.
 *
 * Procedura unica e immutabile (estensione v3.9.56+):
 *   postMessage { direction: "from-webapp-li", action: "sendMessage", url, message }
 *   timeout 120s → HybridOps.sendMessage nell'estensione.
 *
 * Due soli ingressi:
 *   - sendLinkedInDirect()       → solo per chat manuale aperta dall'utente
 *   - queueLinkedInForApproval() → bulk / AI / cadenze / autopilot
 *
 * NON usare il bridge `sendMessage` direttamente altrove. ESLint
 * (`no-direct-extension-send`) lo blocca.
 */
import { supabase } from "@/integrations/supabase/client";
import { sendLinkedIn as sendLinkedInUnified, type SendResult, type LinkedInBridgeSender } from "@/lib/inbox/sendMessage";
import { isLinkedInProfileUrl, normalizeLinkedInProfileUrl } from "@/lib/linkedinSearch";
import { createLogger } from "@/lib/log";

const log = createLogger("linkedinSender");

export interface DirectLinkedInSendArgs {
  profileUrl: string;
  text: string;
  partnerId?: string;
  contactId?: string;
  threadId?: string;
  /** Pagina/contesto chiamante per audit (es: "linkedin-inbox", "partner-detail") */
  source: string;
  /** Callback iniettata dall'hook React per parlare con l'estensione */
  bridgeSender: LinkedInBridgeSender;
}

export async function sendLinkedInDirect(args: DirectLinkedInSendArgs): Promise<SendResult> {
  const url = normalizeLinkedInProfileUrl(args.profileUrl);
  if (!url || !isLinkedInProfileUrl(url)) {
    return { success: false, error: "URL LinkedIn non valido" };
  }
  const text = (args.text || "").slice(0, 300);
  if (!text.trim()) return { success: false, error: "Messaggio vuoto" };

  log.info("direct.send", { source: args.source, url: url.slice(0, 40) });
  return sendLinkedInUnified(
    {
      recipient_url: url,
      text,
      partner_id: args.partnerId,
      contact_id: args.contactId,
      thread_id: args.threadId,
    },
    args.bridgeSender,
  );
}

export interface QueuedLinkedInTarget {
  profileUrl: string;
  contactId?: string;
  partnerId?: string;
  contactName?: string | null;
  companyName?: string | null;
}

export interface QueueLinkedInArgs {
  targets: QueuedLinkedInTarget[];
  /** Già personalizzato per destinatario, OPPURE template con `{{name}}`/`{{company}}` */
  messageOrTemplate: string;
  /** Etichetta sorgente per audit (es: "cadence-engine", "agent-luca", "bulk-li-dialog") */
  source: string;
  /** ISO datetime opzionale; default = now() */
  scheduledFor?: string;
  reasoning?: string;
}

/**
 * Accoda invii LinkedIn in `ai_pending_actions` per approvazione umana.
 * NON invia immediatamente. L'esecuzione avviene solo dopo approvazione,
 * via `pending-action-executor` → edge `send-linkedin`.
 */
export async function queueLinkedInForApproval(args: QueueLinkedInArgs): Promise<{ queued: number; failed: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { queued: 0, failed: args.targets.length };

  let queued = 0;
  let failed = 0;

  for (const t of args.targets) {
    const url = normalizeLinkedInProfileUrl(t.profileUrl);
    if (!url || !isLinkedInProfileUrl(url)) { failed++; continue; }

    const personalized = args.messageOrTemplate
      .replace(/\{\{name\}\}/gi, t.contactName || "")
      .replace(/\{\{company\}\}/gi, t.companyName || "")
      .slice(0, 300);

    const { error } = await supabase.from("ai_pending_actions").insert({
      user_id: userId,
      partner_id: t.partnerId || null,
      action_type: "send_linkedin",
      action_payload: {
        recipient: url,
        message_text: personalized,
        contact_id: t.contactId || null,
        partner_id: t.partnerId || null,
        scheduled_for: args.scheduledFor || new Date().toISOString(),
        contactName: t.contactName,
        companyName: t.companyName,
      },
      reasoning: args.reasoning || `LinkedIn predisposto da ${args.source}. In attesa di autorizzazione.`,
      confidence: 0.85,
      source: args.source,
      status: "pending",
    });
    if (error) { log.warn("queue.insert_failed", { error: error.message, source: args.source }); failed++; }
    else queued++;
  }

  log.info("queue.batch", { source: args.source, queued, failed });
  return { queued, failed };
}
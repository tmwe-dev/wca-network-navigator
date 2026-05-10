/**
 * WhatsApp Sender — SSOT per l'invio WhatsApp dalla web app.
 *
 * Procedura unica:
 *   postMessage { direction: "from-webapp-wa", action: "sendWhatsApp", phone, text }
 *   timeout 60s → useWhatsAppExtensionBridge → estensione WhatsApp.
 *
 * Due soli ingressi:
 *   - sendWhatsAppDirect()       → solo per chat manuale aperta dall'utente
 *   - queueWhatsAppForApproval() → bulk / AI / cadenze / autopilot
 */
import { supabase } from "@/integrations/supabase/client";
import { sendWhatsApp as sendWhatsAppUnified, type SendResult, type WhatsAppBridgeSender } from "@/lib/inbox/sendMessage";
import { createLogger } from "@/lib/log";

const log = createLogger("whatsappSender");

function cleanPhone(phone: string): string {
  return (phone || "").replace(/[\s\-().]/g, "").replace(/^\+/, "");
}

export interface DirectWhatsAppSendArgs {
  phone: string;
  text: string;
  partnerId?: string;
  contactId?: string;
  threadId?: string;
  /** Pagina chiamante per audit */
  source: string;
  /** Callback iniettata dall'hook React */
  bridgeSender: WhatsAppBridgeSender;
}

export async function sendWhatsAppDirect(args: DirectWhatsAppSendArgs): Promise<SendResult> {
  const phone = cleanPhone(args.phone);
  if (!phone) return { success: false, error: "Numero non valido" };
  const text = args.text || "";

  log.info("direct.send", { source: args.source, phone: phone.slice(0, 4) + "***" });
  return sendWhatsAppUnified(
    {
      recipient: phone,
      text,
      partner_id: args.partnerId,
      contact_id: args.contactId,
      thread_id: args.threadId,
    },
    args.bridgeSender,
  );
}

export interface QueuedWhatsAppTarget {
  phone: string;
  contactId?: string;
  partnerId?: string;
  contactName?: string | null;
  companyName?: string | null;
}

export interface QueueWhatsAppArgs {
  targets: QueuedWhatsAppTarget[];
  messageOrTemplate: string;
  source: string;
  scheduledFor?: string;
  reasoning?: string;
}

/**
 * Accoda invii WhatsApp in `ai_pending_actions` per approvazione umana.
 */
export async function queueWhatsAppForApproval(args: QueueWhatsAppArgs): Promise<{ queued: number; failed: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { queued: 0, failed: args.targets.length };

  let queued = 0;
  let failed = 0;

  for (const t of args.targets) {
    const phone = cleanPhone(t.phone);
    if (!phone) { failed++; continue; }

    const personalized = args.messageOrTemplate
      .replace(/\{\{name\}\}/gi, t.contactName || "")
      .replace(/\{\{company\}\}/gi, t.companyName || "");

    const { error } = await supabase.from("ai_pending_actions").insert({
      user_id: userId,
      partner_id: t.partnerId || null,
      action_type: "send_whatsapp",
      action_payload: {
        recipient: phone,
        message_text: personalized,
        contact_id: t.contactId || null,
        partner_id: t.partnerId || null,
        scheduled_for: args.scheduledFor || new Date().toISOString(),
        contactName: t.contactName,
        companyName: t.companyName,
      },
      reasoning: args.reasoning || `WhatsApp predisposto da ${args.source}. In attesa di autorizzazione.`,
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
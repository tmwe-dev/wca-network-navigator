/**
 * useApproveAndDispatch — dispatcher reale on-approve per send_email /
 * send_whatsapp / send_linkedin / linkedin_connect / send_proposal.
 *
 * Riusa esattamente i bridge del cockpit (`useWhatsAppExtensionBridge`,
 * `useLinkedInExtensionBridge`) e l'edge `send-email` per i canali server.
 * Editorial review (`reviewMessage`) è HARD fail-closed e applicata UNA SOLA
 * volta qui, al momento dell'approvazione (memoria editorial-review-layer-mandatory).
 *
 * NON tocca i protocolli `from-webapp-li` / `from-webapp-wa` né le edge
 * `send-linkedin` / `send-whatsapp` (coda morta v3.9.56).
 */
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { reviewMessage } from "@/lib/messaging/reviewMessage";
import DOMPurify from "dompurify";
import { createLogger } from "@/lib/log";

const log = createLogger("useApproveAndDispatch");

type AnyRecord = Record<string, unknown>;

interface DispatchResult {
  success: boolean;
  detail: string;
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function pick(payload: AnyRecord, keys: string[]): string {
  for (const k of keys) {
    const v = payload[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

function buildIdempotencyKey(to: string, subject: string, body: string): string {
  const payload = `${to.trim().toLowerCase()}|${subject.trim()}|${body.trim()}`;
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash + payload.charCodeAt(i)) >>> 0;
  }
  return `send_${hash.toString(36)}_${payload.length}`;
}

export function useApproveAndDispatch() {
  const [dispatching, setDispatching] = useState(false);
  const liBridge = useLinkedInExtensionBridge();
  const waBridge = useWhatsAppExtensionBridge();

  const dispatch = async (pendingActionId: string): Promise<DispatchResult> => {
    setDispatching(true);
    try {
      // 1. Carica l'azione
      const { data: action, error: fetchErr } = await supabase
        .from("ai_pending_actions")
        .select("*")
        .eq("id", pendingActionId)
        .maybeSingle();

      if (fetchErr || !action) {
        const msg = fetchErr?.message ?? "Action not found";
        toast({ title: "Errore caricamento azione", description: msg, variant: "destructive" });
        return { success: false, detail: msg };
      }

      const payload = (action.action_payload ?? {}) as AnyRecord;
      const partnerId = (action.partner_id as string | null) ?? (payload.partner_id as string | null) ?? null;
      const contactId = (action.contact_id as string | null) ?? (payload.contact_id as string | null) ?? null;
      const actionType = String(action.action_type);

      // 2. Editorial review HARD fail-closed (solo per canali messaggio)
      const draftBody =
        actionType === "send_email" || actionType === "send_proposal"
          ? pick(payload, ["draft_body", "html", "body", "html_body"])
          : pick(payload, ["message_text", "message", "body", "draft_body"]);

      let finalText = draftBody;

      if (actionType === "send_whatsapp" || actionType === "send_linkedin" || actionType === "linkedin_connect") {
        try {
          const review = await reviewMessage({
            channel: actionType === "send_whatsapp" ? "whatsapp" : "linkedin",
            draft: draftBody.replace(/<[^>]+>/g, "").trim(),
            partnerId,
            contactId,
          });
          if (review.verdict === "block") {
            toast({
              title: "🛑 Bloccato dalla review editoriale",
              description: review.reasoning_summary || "Messaggio non conforme.",
              variant: "destructive",
            });
            await markAction(pendingActionId, "failed", `editorial_block: ${review.reasoning_summary}`);
            return { success: false, detail: "editorial_block" };
          }
          if (review.verdict === "pass_with_edits" && review.edited_text) {
            finalText = review.edited_text;
          }
        } catch (revErr) {
          const msg = revErr instanceof Error ? revErr.message : String(revErr);
          log.error("review.failed", { error: msg, actionType });
          toast({ title: "Review non disponibile", description: "Invio annullato per sicurezza.", variant: "destructive" });
          await markAction(pendingActionId, "failed", `review_error: ${msg}`);
          return { success: false, detail: "review_error" };
        }
      }

      // 3. Dispatch per canale
      let result: DispatchResult;
      switch (actionType) {
        case "send_email":
        case "send_proposal":
          result = await dispatchEmail(payload, finalText, partnerId, contactId);
          break;
        case "send_whatsapp":
          result = await dispatchWhatsApp(payload, finalText, waBridge);
          break;
        case "send_linkedin":
          result = await dispatchLinkedIn(payload, finalText, liBridge, false);
          break;
        case "linkedin_connect":
          result = await dispatchLinkedIn(payload, finalText, liBridge, true);
          break;
        default:
          result = { success: false, detail: `Tipo non gestito qui: ${actionType}` };
      }

      // 4. Update + audit
      await markAction(pendingActionId, result.success ? "executed" : "failed", result.detail);

      try {
        await supabase.from("supervisor_audit_log").insert({
          user_id: action.user_id,
          actor_type: "user",
          actor_name: "approve-and-dispatch",
          action_category: result.success ? "action_executed" : "action_failed",
          action_detail: `${actionType}: ${result.detail}`,
          target_id: pendingActionId,
          target_type: "pending_action",
          decision_origin: "user_approved",
          metadata: { pending_action_id: pendingActionId, action_type: actionType, result },
        } as never);
      } catch (auditErr) {
        log.warn("audit.failed", { error: auditErr instanceof Error ? auditErr.message : String(auditErr) });
      }

      if (result.success) {
        toast({ title: "✅ Inviato", description: result.detail });
      } else {
        toast({ title: "Invio fallito", description: result.detail, variant: "destructive" });
      }
      return result;
    } finally {
      setDispatching(false);
    }
  };

  return { dispatch, dispatching, liBridge, waBridge };
}

async function markAction(id: string, status: "executed" | "failed", detail: string) {
  await supabase
    .from("ai_pending_actions")
    .update({
      status,
      executed_at: new Date().toISOString(),
      last_error: status === "failed" ? detail : null,
    } as never)
    .eq("id", id);
}

async function dispatchEmail(
  payload: AnyRecord,
  finalBody: string,
  partnerId: string | null,
  contactId: string | null,
): Promise<DispatchResult> {
  const to = pick(payload, ["to", "recipient_email", "email", "email_address"]);
  const subject = pick(payload, ["subject", "draft_subject"]) || "(senza oggetto)";
  if (!to) return { success: false, detail: "Destinatario email mancante" };

  const sanitizedHtml = DOMPurify.sanitize(finalBody || asStr(payload.html) || "", {
    ALLOWED_TAGS: ["br", "p", "b", "i", "strong", "em", "a", "ul", "ol", "li", "h1", "h2", "h3", "span", "div"],
    ALLOWED_ATTR: ["href", "target", "rel", "style"],
  });

  try {
    const data = await invokeEdge<{ error?: string }>("send-email", {
      body: {
        to,
        subject,
        html: sanitizedHtml,
        partner_id: partnerId,
        contact_id: contactId,
        idempotency_key: buildIdempotencyKey(to, subject, sanitizedHtml),
      },
      context: "approveAndDispatch.email",
    });
    if (data?.error) return { success: false, detail: data.error };
    return { success: true, detail: `Email inviata a ${to}` };
  } catch (err) {
    return { success: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function dispatchWhatsApp(
  payload: AnyRecord,
  finalText: string,
  waBridge: ReturnType<typeof useWhatsAppExtensionBridge>,
): Promise<DispatchResult> {
  const phone = pick(payload, ["recipient", "phone", "to"]).replace(/[^0-9+]/g, "").replace(/^\+/, "");
  if (!phone) return { success: false, detail: "Numero WhatsApp mancante" };
  if (!waBridge.isAvailable) return { success: false, detail: "Estensione WhatsApp non rilevata" };
  if (!waBridge.isAuthenticated) return { success: false, detail: "WhatsApp Web non autenticato" };

  const text = (finalText || "").replace(/<[^>]+>/g, "").trim();
  if (!text) return { success: false, detail: "Messaggio vuoto" };

  try {
    const res = await waBridge.sendWhatsApp(phone, text);
    if (res.success) return { success: true, detail: `WhatsApp inviato a ${phone}` };
    return { success: false, detail: res.error || "Bridge WA ha rifiutato l'invio" };
  } catch (err) {
    return { success: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function dispatchLinkedIn(
  payload: AnyRecord,
  finalText: string,
  liBridge: ReturnType<typeof useLinkedInExtensionBridge>,
  isConnect: boolean,
): Promise<DispatchResult> {
  const profileUrl = pick(payload, ["recipient", "profile_url", "to", "url"]);
  if (!profileUrl) return { success: false, detail: "URL LinkedIn mancante" };
  if (!liBridge.isAvailable) return { success: false, detail: "Estensione LinkedIn non rilevata" };

  const text = (finalText || "").replace(/<[^>]+>/g, "").trim().slice(0, 300);
  if (!text && !isConnect) return { success: false, detail: "Messaggio vuoto" };

  try {
    const auth = await liBridge.ensureAuthenticated(0);
    if (!auth.ok) return { success: false, detail: "LinkedIn non autenticato" };

    const res = isConnect
      ? await liBridge.sendConnectionRequest(profileUrl, text)
      : await liBridge.sendDirectMessage(profileUrl, text);
    if (res.success) return { success: true, detail: isConnect ? "Richiesta di collegamento inviata" : "DM LinkedIn inviato" };
    return { success: false, detail: res.error || "Bridge LI ha rifiutato l'invio" };
  } catch (err) {
    return { success: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
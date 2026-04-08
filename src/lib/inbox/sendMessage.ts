/**
 * Send Message — wrapper unificato per l'invio outbound sui 3 canali.
 *
 * Vol. II §5.2 (idempotenza send) — garantisce che ogni invio:
 *  1. passi per rate limiter + circuit breaker (key per canale + user)
 *  2. produca un INSERT in `channel_messages` con direction='outbound'
 *  3. aggiorni lo stato di sessione (alive/expired)
 *  4. logghi via logger strutturato
 *
 * Le 3 view (Email/WhatsApp/LinkedIn) chiamano questo wrapper invece di
 * fare INSERT manuali sparsi nel codice.
 */

import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { withRateLimit, RateLimitedError, CircuitOpenError } from "@/lib/api/rateLimiter";
import { createLogger } from "@/lib/log";
import { sanitizeHtml } from "@/lib/security/htmlSanitizer";
import { markSessionAlive, markSessionExpired } from "./sessionTracker";
import type { ChannelKind } from "./types";

const log = createLogger("sendMessage");

export interface SendResult {
  success: boolean;
  message_id?: string;
  external_id?: string;
  error?: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  partner_id?: string;
  contact_id?: string;
  thread_id?: string;
}

export interface SendWhatsAppParams {
  /** Phone E.164 senza `+`, oppure contact name normalizzato. */
  recipient: string;
  text: string;
  partner_id?: string;
  contact_id?: string;
  thread_id?: string;
}

export interface SendLinkedInParams {
  /** URL del profilo o thread LinkedIn. */
  recipient_url: string;
  text: string;
  partner_id?: string;
  contact_id?: string;
  thread_id?: string;
}

async function persistOutbound(params: {
  channel: ChannelKind;
  to: string;
  body_text: string;
  body_html: string | null;
  subject: string | null;
  partner_id?: string;
  /** Reservado para uso futuro: lo schema attuale di channel_messages non ha contact_id. */
  contact_id?: string;
  thread_id?: string;
  external_id?: string;
}): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user_id = userData.user?.id;
  if (!user_id) {
    log.error("send.no_user");
    return null;
  }

  const { data, error } = await supabase
    .from("channel_messages")
    .insert({
      user_id,
      channel: params.channel,
      direction: "outbound",
      to_address: params.to,
      from_address: null,
      subject: params.subject,
      body_text: params.body_text,
      body_html: params.body_html,
      message_id_external: params.external_id ?? null,
      thread_id: params.thread_id ?? null,
      partner_id: params.partner_id ?? null,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    log.error("send.persist_failed", {
      channel: params.channel,
      error: error.message,
    });
    return null;
  }
  return data?.id ?? null;
}

function rateLimitKey(channel: ChannelKind, userId: string): string {
  return `${channel}:${userId}`;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? "anonymous";
}

/* ─────────────────────────── EMAIL ─────────────────────────── */

export async function sendEmail(params: SendEmailParams): Promise<SendResult> {
  const userId = await currentUserId();
  const key = rateLimitKey("email", userId);

  try {
    const safeHtml = sanitizeHtml(params.html);
    const result = await withRateLimit(key, () =>
      invokeEdge<{ success: boolean; message_id?: string }>("send-email", {
        body: {
          to: params.to,
          subject: params.subject,
          html: safeHtml,
          partner_id: params.partner_id,
        },
        context: "sendMessage.email",
      })
    );

    const messageId = await persistOutbound({
      channel: "email",
      to: params.to,
      body_text: stripHtml(safeHtml),
      body_html: safeHtml,
      subject: params.subject,
      partner_id: params.partner_id,
      contact_id: params.contact_id,
      thread_id: params.thread_id,
      external_id: result?.message_id,
    });

    await markSessionAlive("email", { last_send_at: new Date().toISOString() });
    log.info("send.email.ok", { to: redact(params.to) });
    return { success: true, message_id: messageId ?? undefined, external_id: result?.message_id };
  } catch (err) {
    return handleSendError("email", err);
  }
}

/* ─────────────────────────── WHATSAPP ─────────────────────────── */

/**
 * Funzione di tipo che implementa l'invio fisico via extension bridge.
 * Iniettata dall'hook React (`useWhatsAppExtensionBridge`) per evitare
 * dipendenza circolare hook→lib.
 */
export type WhatsAppBridgeSender = (recipient: string, text: string) => Promise<{
  success: boolean;
  external_id?: string;
  error?: string;
}>;

export async function sendWhatsApp(
  params: SendWhatsAppParams,
  bridge: WhatsAppBridgeSender
): Promise<SendResult> {
  const userId = await currentUserId();
  const key = rateLimitKey("whatsapp", userId);

  try {
    const result = await withRateLimit(key, () => bridge(params.recipient, params.text));
    if (!result.success) {
      throw new Error(result.error || "WhatsApp bridge returned failure");
    }

    const messageId = await persistOutbound({
      channel: "whatsapp",
      to: params.recipient,
      body_text: params.text,
      body_html: null,
      subject: null,
      partner_id: params.partner_id,
      contact_id: params.contact_id,
      thread_id: params.thread_id,
      external_id: result.external_id,
    });

    await markSessionAlive("whatsapp", { last_send_at: new Date().toISOString() });
    log.info("send.whatsapp.ok", { to: redact(params.recipient) });
    return { success: true, message_id: messageId ?? undefined, external_id: result.external_id };
  } catch (err) {
    return handleSendError("whatsapp", err);
  }
}

/* ─────────────────────────── LINKEDIN ─────────────────────────── */

export type LinkedInBridgeSender = (
  recipientUrl: string,
  text: string
) => Promise<{ success: boolean; external_id?: string; error?: string }>;

export async function sendLinkedIn(
  params: SendLinkedInParams,
  bridge: LinkedInBridgeSender
): Promise<SendResult> {
  const userId = await currentUserId();
  const key = rateLimitKey("linkedin", userId);

  try {
    const result = await withRateLimit(key, () =>
      bridge(params.recipient_url, params.text)
    );
    if (!result.success) {
      throw new Error(result.error || "LinkedIn bridge returned failure");
    }

    const messageId = await persistOutbound({
      channel: "linkedin",
      to: params.recipient_url,
      body_text: params.text,
      body_html: null,
      subject: null,
      partner_id: params.partner_id,
      contact_id: params.contact_id,
      thread_id: params.thread_id,
      external_id: result.external_id,
    });

    await markSessionAlive("linkedin", { last_send_at: new Date().toISOString() });
    log.info("send.linkedin.ok", { to: redact(params.recipient_url) });
    return { success: true, message_id: messageId ?? undefined, external_id: result.external_id };
  } catch (err) {
    return handleSendError("linkedin", err);
  }
}

/* ─────────────────────────── HELPERS ─────────────────────────── */

async function handleSendError(channel: ChannelKind, err: unknown): Promise<SendResult> {
  const msg = err instanceof Error ? err.message : String(err);

  if (err instanceof CircuitOpenError) {
    await markSessionExpired(channel, `circuit open: ${msg}`);
    log.error("send.circuit_open", { channel, resetInMs: err.resetInMs });
    return { success: false, error: `Sessione ${channel} sospesa, riprova tra ${Math.ceil(err.resetInMs / 1000)}s` };
  }
  if (err instanceof RateLimitedError) {
    log.warn("send.rate_limited", { channel, retryAfterMs: err.retryAfterMs });
    return { success: false, error: `Rate limit ${channel}, riprova tra ${Math.ceil(err.retryAfterMs / 1000)}s` };
  }

  // Heuristic: se l'errore parla di auth/session, marca session expired
  if (/auth|session|login|expired|unauthorized/i.test(msg)) {
    await markSessionExpired(channel, msg);
  }

  log.error("send.failed", { channel, error: msg });
  return { success: false, error: msg };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function redact(addr: string): string {
  if (!addr) return "";
  if (addr.includes("@")) {
    const [user, domain] = addr.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  }
  if (addr.length > 6) return `${addr.slice(0, 3)}***${addr.slice(-2)}`;
  return "***";
}

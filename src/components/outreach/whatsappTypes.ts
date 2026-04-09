/**
 * Tipi condivisi per i componenti WhatsApp — contratto unico (Documento 2 §2.2).
 */
import type { ChannelMessage } from "@/hooks/useChannelMessages";

export type ChatThread = {
  contact: string;
  lastMessage: ChannelMessage;
  unreadCount: number;
  messages: ChannelMessage[];
};

/** Estrae numero di telefono da un thread WhatsApp */
export function extractPhoneFromThread(thread: ChatThread): string | null {
  for (const msg of thread.messages) {
    const payload = msg.raw_payload as Record<string, unknown> | null | undefined;
    if (!payload) continue;
    if (typeof payload.phone === "string" && payload.phone.replace(/\D/g, "").length >= 5) return payload.phone.replace(/\D/g, "");
    if (typeof payload.jid === "string") { const m = payload.jid.match(/^(\d{5,})@/); if (m) return m[1]; }
    if (typeof payload.sender === "string") { const d = payload.sender.replace(/\D/g, ""); if (d.length >= 5) return d; }
    if (msg.direction === "inbound" && typeof msg.from_address === "string") { const d = msg.from_address.replace(/\D/g, ""); if (d.length >= 5) return d; }
  }
  const contactDigits = thread.contact.replace(/\D/g, "");
  if (contactDigits.length >= 5) return contactDigits;
  return null;
}

/** Identifica messaggi "fantasma" dalla sidebar (non veri messaggi) */
export function isSidebarGhostMessage(msg: ChannelMessage): boolean {
  const payload = msg.raw_payload as Record<string, unknown> | null | undefined;
  if (!payload) return false;
  if (payload.isVerify === true) return true;
  const hasSidebarShape =
    Object.prototype.hasOwnProperty.call(payload, "contact") ||
    Object.prototype.hasOwnProperty.call(payload, "lastMessage") ||
    Object.prototype.hasOwnProperty.call(payload, "unreadCount");
  if (!hasSidebarShape) return false;
  const payloadLastMessage = typeof payload.lastMessage === "string" ? payload.lastMessage.trim() : "";
  const payloadText = typeof payload.text === "string" ? payload.text.trim() : "";
  const bodyText = msg.body_text?.trim() || "";
  return !bodyText && !payloadLastMessage && !payloadText;
}

export const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "image/gif"];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

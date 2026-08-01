/**
 * Tipi unificati per i 3 canali di messaggistica.
 *
 * Vol. II §5.1 (contratti API espliciti) — un solo schema discriminato
 * elimina cast `any` sparsi nelle 3 view inbox.
 */

export type ChannelKind = "email" | "whatsapp" | "linkedin";

export type MessageDirection = "inbound" | "outbound";

/** Payload raw specifico per email (IMAP). */
export interface EmailRawPayload {
  imap_uid?: number;
  uidvalidity?: number;
  message_id?: string;
  in_reply_to?: string;
  references?: string[];
  attachments?: Array<{ filename: string; content_type: string; size: number }>;
}

/** Payload raw specifico per WhatsApp (extension scrape). */
export interface WhatsAppRawPayload {
  jid?: string;
  phone?: string;
  contact_name?: string;
  group_name?: string;
  is_group?: boolean;
  message_type?: "text" | "image" | "audio" | "video" | "document";
}

/** Payload raw specifico per LinkedIn (extension scrape o FireScrape). */
export interface LinkedInRawPayload {
  profile_url?: string;
  profile_name?: string;
  conversation_url?: string;
  source?: "extension" | "firescrape";
  message_type?: "dm" | "inmail" | "connection_note";
}

/** Discriminated union — type-safe access al raw_payload. */
export type ChannelRawPayload =
  | { channel: "email"; payload: EmailRawPayload }
  | { channel: "whatsapp"; payload: WhatsAppRawPayload }
  | { channel: "linkedin"; payload: LinkedInRawPayload };

/** Riga normalizzata letta da `channel_messages`. */
export interface ChannelMessage<T extends ChannelKind = ChannelKind> {
  id: string;
  user_id: string;
  channel: T;
  direction: MessageDirection;
  from_address: string | null;
  to_address: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  message_id_external: string | null;
  thread_id: string | null;
  partner_id: string | null;
  contact_id: string | null;
  read_at: string | null;
  created_at: string;
  raw_payload: T extends "email"
    ? EmailRawPayload
    : T extends "whatsapp"
      ? WhatsAppRawPayload
      : T extends "linkedin"
        ? LinkedInRawPayload
        : Record<string, unknown>;
}

/** Stato di sessione runtime per un canale. */
export type SessionStatus = "active" | "expired" | "disconnected" | "unknown";

export interface ChannelSession {
  channel: ChannelKind;
  status: SessionStatus;
  last_seen_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
}

/** Type guard helpers per discriminare il payload. */
export function isEmailMessage(
  msg: ChannelMessage
): msg is ChannelMessage<"email"> {
  return msg.channel === "email";
}

export function isWhatsAppMessage(
  msg: ChannelMessage
): msg is ChannelMessage<"whatsapp"> {
  return msg.channel === "whatsapp";
}

export function isLinkedInMessage(
  msg: ChannelMessage
): msg is ChannelMessage<"linkedin"> {
  return msg.channel === "linkedin";
}

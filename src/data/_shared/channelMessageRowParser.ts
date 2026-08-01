/**
 * Validatori runtime per le righe lette dalla sorgente dinamica dell'Inbox
 * (`message_intelligence_v` | `channel_messages`).
 *
 * Sostituiscono i cast: una riga che non rispetta il contratto minimo
 * (identificatori stringa) viene scartata invece di entrare nel dominio.
 */
import type { ChannelMessage } from "@/hooks/useChannelMessages";

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function strArray(v: unknown): string[] | null {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
}

/** Riga completa Inbox. Ritorna null se mancano gli identificatori minimi. */
export function parseChannelMessageRow(row: Record<string, unknown>): ChannelMessage | null {
  const id = str(row.id);
  const userId = str(row.user_id);
  const channel = str(row.channel);
  const direction = str(row.direction);
  const createdAt = str(row.created_at) ?? str(row.message_created_at);
  if (!id || !userId || !channel || !direction || !createdAt) return null;

  return {
    id,
    user_id: userId,
    channel,
    direction,
    created_at: createdAt,
    source_type: str(row.source_type),
    source_id: str(row.source_id),
    partner_id: str(row.partner_id),
    mailbox_id: str(row.mailbox_id),
    from_address: str(row.from_address),
    to_address: str(row.to_address),
    cc_addresses: str(row.cc_addresses),
    bcc_addresses: str(row.bcc_addresses),
    subject: str(row.subject),
    body_text: str(row.body_text),
    body_html: str(row.body_html),
    raw_payload: row.raw_payload,
    message_id_external: str(row.message_id_external),
    in_reply_to: str(row.in_reply_to),
    read_at: str(row.read_at),
    email_date: str(row.email_date),
    raw_storage_path: str(row.raw_storage_path),
    raw_sha256: str(row.raw_sha256),
    raw_size_bytes: num(row.raw_size_bytes),
    imap_uid: num(row.imap_uid),
    uidvalidity: num(row.uidvalidity),
    imap_flags: str(row.imap_flags),
    internal_date: str(row.internal_date),
    parse_status: str(row.parse_status),
    parse_warnings: strArray(row.parse_warnings),
    thread_id: str(row.thread_id),
    references_header: str(row.references_header),
  };
}

export interface InboxBodyRow {
  message_id_external: string;
  subject: string | null;
  from_address: string | null;
  body_text: string | null;
  body_html: string | null;
  email_date: string | null;
  partner_id: string | null;
}

/** Proiezione ridotta usata dal join logico per cartella. */
export function parseInboxBodyRow(row: Record<string, unknown>): InboxBodyRow | null {
  const externalId = str(row.message_id_external);
  if (!externalId) return null;
  return {
    message_id_external: externalId,
    subject: str(row.subject),
    from_address: str(row.from_address),
    body_text: str(row.body_text),
    body_html: str(row.body_html),
    email_date: str(row.email_date),
    partner_id: str(row.partner_id),
  };
}

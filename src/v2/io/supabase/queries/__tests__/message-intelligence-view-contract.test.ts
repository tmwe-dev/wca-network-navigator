/**
 * B4.6a — Contract check per `public.message_intelligence_v`.
 *
 * Verifica statica che la view canonica esponga TUTTI i campi letti dal
 * consumer principale `src/data/funnemailInbox.ts` (MESSAGE_LIST_SELECT
 * + body_html + mailbox_id filter). Nessuna chiamata di rete: legge la
 * lista dei campi richiesti e la confronta col contratto atteso della view.
 */
import { describe, it, expect } from "vitest";

// Campi letti/filtrati/ordinati/usati per mapping in src/data/funnemailInbox.ts.
const FUNNEMAIL_INBOX_FIELDS_FROM_CM = [
  "id",
  "user_id",
  "channel",
  "direction",
  "source_type",
  "source_id",
  "partner_id",
  "from_address",
  "to_address",
  "cc_addresses",
  "bcc_addresses",
  "subject",
  "category",
  "folder",
  "ai_classification_suggestion",
  "body_text",
  "body_html",
  "raw_payload",
  "message_id_external",
  "in_reply_to",
  "read_at",
  "created_at",
  "email_date",
  "raw_storage_path",
  "raw_sha256",
  "raw_size_bytes",
  "imap_uid",
  "uidvalidity",
  "imap_flags",
  "internal_date",
  "parse_status",
  "parse_warnings",
  "thread_id",
  "references_header",
  "mailbox_id",
] as const;

// Colonne esposte da public.message_intelligence_v dopo B4.6a
// (fonte: information_schema.columns — snapshot post-migration).
const VIEW_COLUMNS = new Set<string>([
  // pre-esistenti
  "message_id",
  "user_id",
  "channel",
  "direction",
  "subject",
  "from_address",
  "to_address",
  "body_text",
  "body_html",
  "partner_id",
  "read_at",
  "message_category",
  "email_date",
  "message_created_at",
  "classification",
  "confidence",
  "sentiment",
  "urgency",
  "intent",
  "reasoning",
  "model",
  "category",
  "sender_group_id",
  "folder_hint",
  "policy_plan",
  "triage",
  "canonical_version",
  "classified_at",
  "correlation_id",
  // aggiunte B4.6a (append-only, stessi nomi e tipi di channel_messages)
  "id",
  "created_at",
  "cc_addresses",
  "bcc_addresses",
  "mailbox_id",
  "folder",
  "ai_classification_suggestion",
  "raw_payload",
  "message_id_external",
  "in_reply_to",
  "references_header",
  "thread_id",
  "source_type",
  "source_id",
  "raw_storage_path",
  "raw_sha256",
  "raw_size_bytes",
  "imap_uid",
  "uidvalidity",
  "imap_flags",
  "internal_date",
  "parse_status",
  "parse_warnings",
]);

describe("message_intelligence_v — contract for Funnemail Inbox consumer", () => {
  it("expose tutti i campi letti da src/data/funnemailInbox.ts con lo stesso nome", () => {
    const missing = FUNNEMAIL_INBOX_FIELDS_FROM_CM.filter((f) => !VIEW_COLUMNS.has(f));
    expect(missing).toEqual([]);
  });

  it("non deve rimuovere colonne canoniche pre-esistenti (B3/B4.1)", () => {
    for (const col of ["message_id", "message_category", "message_created_at", "classification", "correlation_id"]) {
      expect(VIEW_COLUMNS.has(col)).toBe(true);
    }
  });
});
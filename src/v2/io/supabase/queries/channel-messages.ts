/**
 * IO Queries: Channel Messages — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type ChannelMessage } from "../../../core/domain/entities";
import { mapChannelMessageRow } from "../../../core/mappers/channel-message-mapper";
import { createLogger } from "@/lib/log";

const log = createLogger("dal:recipient-history");

export async function fetchChannelMessages(
  limit = 100,
  direction?: string,
): Promise<Result<ChannelMessage[], AppError>> {
  try {
    let query = supabase
      .from("channel_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (direction) query = query.eq("direction", direction);
    const { data, error } = await query;
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "channel_messages" }, "fetchChannelMessages"));
    if (!data) return ok([]);
    const msgs: ChannelMessage[] = [];
    for (const row of data) {
      const mapped = mapChannelMessageRow(row);
      if (mapped._tag === "Err") return mapped;
      msgs.push(mapped.value);
    }
    return ok(msgs);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchChannelMessages"));
  }
}

/**
 * B4.1 — Legge dalla view canonica `message_intelligence_v` (read-only,
 * SECURITY INVOKER). Espone TUTTI i messaggi autorizzati (anche non
 * classificati) tramite LEFT JOIN LATERAL alla classificazione più recente.
 * `category` del ChannelMessage = `message_category` originale di
 * channel_messages (non la category AI derivata). Il consumer deve fare
 * fallback su `fetchChannelMessages` solo in caso di errore/indisponibilità.
 */
export async function fetchChannelMessagesFromView(
  limit = 100,
  direction?: string,
): Promise<Result<ChannelMessage[], AppError>> {
  try {
    let query = supabase
      .from("message_intelligence_v")
      .select(
        "message_id,user_id,channel,direction,subject,from_address,to_address,body_text,body_html,partner_id,message_category,read_at,email_date,message_created_at",
      )
      .order("message_created_at", { ascending: false })
      .limit(limit);
    if (direction) query = query.eq("direction", direction);
    const { data, error } = await query;
    if (error) {
      return err(
        ioError(
          "DATABASE_ERROR",
          error.message,
          { table: "message_intelligence_v" },
          "fetchChannelMessagesFromView",
        ),
      );
    }
    if (!data) return ok([]);
    const msgs: ChannelMessage[] = [];
    for (const row of data as Array<Record<string, unknown>>) {
      const mapped = mapChannelMessageRow({
        id: row.message_id,
        user_id: row.user_id,
        channel: row.channel,
        direction: row.direction,
        subject: row.subject ?? null,
        from_address: row.from_address ?? null,
        to_address: row.to_address ?? null,
        body_text: row.body_text ?? null,
        body_html: row.body_html ?? null,
        partner_id: row.partner_id ?? null,
        category: row.message_category ?? null,
        read_at: row.read_at ?? null,
        email_date: row.email_date ?? null,
        created_at: row.message_created_at,
      });
      if (mapped._tag === "Err") return mapped;
      msgs.push(mapped.value);
    }
    return ok(msgs);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchChannelMessagesFromView"));
  }
}

// ── B4.2 — Recipient history (usato dal consumer HistoryTab di Email Forge) ──

export interface RecipientHistoryFilter {
  readonly partnerId?: string | null;
  readonly email?: string | null;
  readonly limit?: number;
}

export interface RecipientHistoryRow {
  readonly id: string;
  readonly channel: string;
  readonly direction: string;
  readonly subject: string | null;
  readonly body_text: string | null;
  readonly from_address: string | null;
  readonly email_date: string | null;
  readonly created_at: string;
}

const RECIPIENT_HISTORY_COLS_VIEW =
  "id:message_id, channel, direction, subject, body_text, from_address, email_date, created_at:message_created_at";

const RECIPIENT_HISTORY_COLS_LEGACY =
  "id, channel, direction, subject, body_text, from_address, email_date, created_at";

async function queryRecipientHistoryFromView(
  partnerId: string | null | undefined,
  email: string | null | undefined,
  limit: number,
): Promise<Result<RecipientHistoryRow[], AppError>> {
  try {
    let q = supabase
      .from("message_intelligence_v")
      .select(RECIPIENT_HISTORY_COLS_VIEW)
      .order("message_created_at", { ascending: false })
      .limit(limit);
    if (partnerId) q = q.eq("partner_id", partnerId);
    else if (email) q = q.or(`from_address.ilike.${email},to_address.ilike.${email}`);
    const { data, error } = await q;
    if (error) {
      return err(
        ioError("DATABASE_ERROR", error.message, { table: "message_intelligence_v" }, "recipientHistory:view"),
      );
    }
    return ok((data ?? []) as unknown as RecipientHistoryRow[]);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "recipientHistory:view"));
  }
}

async function queryRecipientHistoryFromLegacy(
  partnerId: string | null | undefined,
  email: string | null | undefined,
  limit: number,
): Promise<Result<RecipientHistoryRow[], AppError>> {
  try {
    let q = supabase
      .from("channel_messages")
      .select(RECIPIENT_HISTORY_COLS_LEGACY)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (partnerId) q = q.eq("partner_id", partnerId);
    else if (email) q = q.or(`from_address.ilike.${email},to_address.ilike.${email}`);
    const { data, error } = await q;
    if (error) {
      return err(
        ioError("DATABASE_ERROR", error.message, { table: "channel_messages" }, "recipientHistory:legacy"),
      );
    }
    return ok((data ?? []) as unknown as RecipientHistoryRow[]);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "recipientHistory:legacy"));
  }
}

/**
 * B4.2 — Public SSOT per la history di un destinatario.
 * Sorgente primaria: view canonica `message_intelligence_v`. Se la view
 * risponde con errore, si esegue fallback trasparente su `channel_messages`.
 * Filtri: `partnerId` ha precedenza; altrimenti OR ILIKE su from/to address.
 * Ordine DESC, limit default 10. Nessun fetch se nessun filtro.
 */
export async function fetchRecipientHistory(
  filter: RecipientHistoryFilter,
): Promise<Result<RecipientHistoryRow[], AppError>> {
  const { partnerId, email } = filter;
  const limit = filter.limit ?? 10;
  if (!partnerId && !email) return ok([]);
  const viewResult = await queryRecipientHistoryFromView(partnerId, email, limit);
  if (viewResult._tag === "Ok") return viewResult;
  log.warn("recipient_history_view_fallback", { code: viewResult.error.code });
  return queryRecipientHistoryFromLegacy(partnerId, email, limit);
}

// ── B4.3 — Messaggi per elenco mittenti (consumer: ExportSendersDialog) ──

export interface SenderMessageRow {
  readonly id: string;
  readonly email_date: string | null;
  readonly direction: string | null;
  readonly from_address: string | null;
  readonly to_address: string | null;
  readonly subject: string | null;
  readonly body_text: string | null;
}

const SENDER_MSGS_COLS_VIEW =
  "id:message_id, email_date, direction, from_address, to_address, subject, body_text";
const SENDER_MSGS_COLS_LEGACY =
  "id, email_date, direction, from_address, to_address, subject, body_text";

async function querySenderMessagesFromView(
  senders: readonly string[],
  limit: number,
): Promise<Result<SenderMessageRow[], AppError>> {
  try {
    const { data, error } = await supabase
      .from("message_intelligence_v")
      .select(SENDER_MSGS_COLS_VIEW)
      .eq("channel", "email")
      .in("from_address", senders as string[])
      .order("email_date", { ascending: false })
      .limit(limit);
    if (error) {
      return err(
        ioError("DATABASE_ERROR", error.message, { table: "message_intelligence_v" }, "senderMessages:view"),
      );
    }
    return ok((data ?? []) as unknown as SenderMessageRow[]);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "senderMessages:view"));
  }
}

async function querySenderMessagesFromLegacy(
  senders: readonly string[],
  limit: number,
): Promise<Result<SenderMessageRow[], AppError>> {
  try {
    const { data, error } = await supabase
      .from("channel_messages")
      .select(SENDER_MSGS_COLS_LEGACY)
      .eq("channel", "email")
      .in("from_address", senders as string[])
      .order("email_date", { ascending: false })
      .limit(limit);
    if (error) {
      return err(
        ioError("DATABASE_ERROR", error.message, { table: "channel_messages" }, "senderMessages:legacy"),
      );
    }
    return ok((data ?? []) as unknown as SenderMessageRow[]);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "senderMessages:legacy"));
  }
}

/**
 * B4.3 — Public SSOT per l'export dei messaggi email di un set di mittenti.
 * Sorgente primaria: view canonica `message_intelligence_v`. Fallback
 * trasparente su `channel_messages` in caso di errore/indisponibilità.
 * Filtri: channel="email" + from_address IN senders. Ordine email_date DESC.
 * Nessun fetch se la lista mittenti è vuota.
 */
export async function fetchMessagesBySenders(
  senders: readonly string[],
  limit = 2000,
): Promise<Result<SenderMessageRow[], AppError>> {
  if (senders.length === 0) return ok([]);
  const viewResult = await querySenderMessagesFromView(senders, limit);
  if (viewResult._tag === "Ok") return viewResult;
  log.warn("sender_messages_view_fallback", { code: viewResult.error.code });
  return querySenderMessagesFromLegacy(senders, limit);
}

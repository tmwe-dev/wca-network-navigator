/**
 * IO Queries: Channel Messages — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type ChannelMessage } from "../../../core/domain/entities";
import { mapChannelMessageRow } from "../../../core/mappers/channel-message-mapper";

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
 * SECURITY INVOKER). Restituisce solo messaggi già classificati.
 * Campi assenti nella view (body_text, body_html, to_address, partner_id,
 * read_at) vengono impostati a null per preservare la shape di ChannelMessage.
 * Il consumer deve fare fallback su `fetchChannelMessages` in caso di errore.
 */
export async function fetchChannelMessagesFromView(
  limit = 100,
  direction?: string,
): Promise<Result<ChannelMessage[], AppError>> {
  try {
    // deno-lint-ignore no-explicit-any
    let query = (supabase as any)
      .from("message_intelligence_v")
      .select(
        "message_id,user_id,channel,direction,subject,from_address,email_date,message_created_at",
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
        to_address: null,
        body_text: null,
        body_html: null,
        partner_id: null,
        category: null,
        read_at: null,
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

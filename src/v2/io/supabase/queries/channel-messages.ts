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

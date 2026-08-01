/**
 * IO Mutations: Channel Messages — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";

export async function markMessageRead(messageId: string): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabase
      .from("channel_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", messageId);
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "channel_messages", messageId }, "markMessageRead"));
    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "markMessageRead"));
  }
}

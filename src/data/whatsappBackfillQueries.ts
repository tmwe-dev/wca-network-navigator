/**
 * DAL — Queries for the deprecated useWhatsAppBackfill (kept for reference only).
 */
import { supabase } from "@/integrations/supabase/client";

export interface BackfillCursorRow {
  oldest_message_external_id: string | null;
  oldest_message_at: string | null;
  reached_beginning: boolean | null;
  messages_imported: number | null;
}

export async function getChannelBackfillCursor(externalChatId: string): Promise<BackfillCursorRow | null> {
  const { data } = await supabase
    .from("channel_backfill_state")
    .select("oldest_message_external_id, oldest_message_at, reached_beginning, messages_imported")
    .eq("channel", "whatsapp")
    .eq("external_chat_id", externalChatId)
    .maybeSingle();
  return (data as BackfillCursorRow | null) ?? null;
}

export async function upsertChannelMessageIgnoreDup(row: Record<string, unknown>): Promise<{ error: { message: string } | null; status: number }> {
  const { error, status } = await supabase
    .from("channel_messages")
    .upsert(row as never, { onConflict: "message_id_external", ignoreDuplicates: true });
  return { error, status };
}

export async function upsertChannelBackfillState(row: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from("channel_backfill_state")
    .upsert(row as never, { onConflict: "operator_id,channel,external_chat_id" });
  if (error) throw error;
}

/** Operatore associato a un utente, per il flusso di backfill WhatsApp deprecato. */
export async function findOperatorIdByUserId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("operators")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

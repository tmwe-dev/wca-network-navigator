/**
 * Queries for command conversations (multi-turn memory)
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { fromUnknown } from "../../../core/domain/errors";

export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  started_at: string;
  last_message_at: string;
  archived: boolean;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_id: string | null;
  tool_result: unknown;
  created_at: string;
}

export async function fetchConversations(limit = 30): Promise<Result<Conversation[]>> {
  try {
    const { data, error } = await (supabase as any)
      .from("command_conversations")
      .select("*")
      .eq("archived", false)
      .order("last_message_at", { ascending: false })
      .limit(limit);
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok((data ?? []) as Conversation[]);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

export async function fetchConversationMessages(
  conversationId: string,
  limit = 50,
): Promise<Result<ConversationMessage[]>> {
  try {
    const { data, error } = await (supabase as any)
      .from("command_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok((data ?? []) as ConversationMessage[]);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

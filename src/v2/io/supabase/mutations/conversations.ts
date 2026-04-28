/**
 * Mutations for command conversations (multi-turn memory)
 */
import { type Result, ok, err } from "../../../core/domain/result";
import { fromUnknown } from "../../../core/domain/errors";
import type { Conversation, ConversationMessage } from "../queries/conversations";
import { untypedFrom } from "@/lib/supabaseUntyped";

export async function createConversation(
  userId: string,
  title?: string,
): Promise<Result<Conversation>> {
  try {
    const { data, error } = await untypedFrom("command_conversations")
      .insert({ user_id: userId, title: title ?? null })
      .select()
      .single();
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok(data as Conversation);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

export async function appendMessage(
  conversationId: string,
  msg: {
    role: "user" | "assistant" | "tool" | "system";
    content: string;
    tool_id?: string;
    tool_result?: unknown;
  },
): Promise<Result<ConversationMessage>> {
  try {
    const { data, error } = await untypedFrom("command_messages")
      .insert({
        conversation_id: conversationId,
        role: msg.role,
        content: msg.content,
        tool_id: msg.tool_id ?? null,
        tool_result: msg.tool_result ?? null,
      })
      .select()
      .single();
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));

    // Bump last_message_at
    await untypedFrom("command_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return ok(data as ConversationMessage);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

export async function updateConversationTitle(
  id: string,
  title: string,
): Promise<Result<void>> {
  try {
    const { error } = await untypedFrom("command_conversations")
      .update({ title })
      .eq("id", id);
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok(undefined);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

export async function archiveConversation(id: string): Promise<Result<void>> {
  try {
    const { error } = await untypedFrom("command_conversations")
      .update({ archived: true })
      .eq("id", id);
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok(undefined);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

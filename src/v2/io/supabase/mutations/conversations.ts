/**
 * Mutations for command conversations (multi-turn memory)
 */
import { type Result, ok, err } from "../../../core/domain/result";
import { fromUnknown } from "../../../core/domain/errors";
import type { Conversation, ConversationMessage } from "../queries/conversations";
import { supabase } from "@/integrations/supabase/client";
import { toJsonValue } from "@/lib/typedJson";
import type { Tables } from "@/integrations/supabase/types";

const MESSAGE_ROLES = ["user", "assistant", "tool", "system"] as const;
type MessageRole = (typeof MESSAGE_ROLES)[number];

function parseRole(value: string): MessageRole {
  return (MESSAGE_ROLES as readonly string[]).includes(value) ? (value as MessageRole) : "assistant";
}

function mapMessage(row: Tables<"command_messages">): ConversationMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    role: parseRole(row.role),
    content: row.content,
    tool_id: row.tool_id,
    tool_result: row.tool_result,
    created_at: row.created_at,
  };
}

export async function createConversation(userId: string, title?: string): Promise<Result<Conversation>> {
  try {
    const { data, error } = await supabase
      .from("command_conversations")
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
    const { data, error } = await supabase
      .from("command_messages")
      .insert({
        conversation_id: conversationId,
        role: msg.role,
        content: msg.content,
        tool_id: msg.tool_id ?? null,
        tool_result: msg.tool_result == null ? null : toJsonValue(msg.tool_result),
      })
      .select()
      .single();
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));

    // Bump last_message_at
    await supabase
      .from("command_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return ok(mapMessage(data));
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

export async function updateConversationTitle(id: string, title: string): Promise<Result<void>> {
  try {
    const { error } = await supabase.from("command_conversations").update({ title }).eq("id", id);
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok(undefined);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

export async function archiveConversation(id: string): Promise<Result<void>> {
  try {
    const { error } = await supabase.from("command_conversations").update({ archived: true }).eq("id", id);
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok(undefined);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

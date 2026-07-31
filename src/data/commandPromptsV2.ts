/**
 * DAL — command_conversations / command_messages (suggerimenti prompt V2).
 */
import { supabase } from "@/integrations/supabase/client";

export async function findUserConversationIds(userId: string, limit = 200): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("command_conversations")
    .select("id")
    .eq("user_id", userId)
    .limit(limit);
  if (error || !data) return null;
  return data.map((c) => c.id);
}

export interface RecentUserMessage {
  readonly content: string | null;
  readonly created_at: string;
}

export async function findRecentUserMessages(
  conversationIds: string[],
  sinceIso: string,
  limit: number,
): Promise<RecentUserMessage[] | null> {
  const { data, error } = await supabase
    .from("command_messages")
    .select("content, created_at")
    .in("conversation_id", conversationIds)
    .eq("role", "user")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return null;
  return data;
}

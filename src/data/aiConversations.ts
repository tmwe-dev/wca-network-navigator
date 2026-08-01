/**
 * DAL — ai_conversations
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json, Database } from "@/integrations/supabase/types";

type AiConversationUpdate = Database["public"]["Tables"]["ai_conversations"]["Update"];

export async function findConversations(userId: string, pageContext: string, limit = 30) {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, messages, page_context, updated_at")
    .eq("user_id", userId)
    .eq("page_context", pageContext)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getConversation(id: string) {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, messages, page_context, updated_at")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createConversation(params: { user_id: string; page_context: string; title: string; messages: unknown[] }) {
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert([{ ...params, messages: params.messages as unknown as Json[] }])
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function updateConversation(id: string, updates: AiConversationUpdate) {
  const { error } = await supabase.from("ai_conversations").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteConversation(id: string) {
  const { error } = await supabase.from("ai_conversations").delete().eq("id", id);
  if (error) throw error;
}

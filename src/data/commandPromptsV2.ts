/**
 * DAL — command_conversations / command_messages (suggerimenti prompt V2).
 */
import { supabase } from "@/integrations/supabase/client";

export async function findUserConversationIds(userId: string, limit = 200): Promise<string[] | null> {
  const { data, error } = await supabase.from("command_conversations").select("id").eq("user_id", userId).limit(limit);
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

export interface CommandHelpPromptRow {
  readonly id: string;
  readonly name: string;
  readonly objective: string | null;
  readonly priority: number | null;
  readonly is_active: boolean | null;
  readonly tags: readonly string[] | null;
}

export interface CommandHelpKbRow {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly chapter: string | null;
  readonly priority: number | null;
  readonly is_active: boolean | null;
}

/** Prompt operativi (context=command) + KB command_tools/ai_memory attivi, per la pagina di help del Command. */
export async function findCommandHelpPromptsAndKb(): Promise<{
  prompts: CommandHelpPromptRow[];
  kb: CommandHelpKbRow[];
}> {
  const [promptsRes, kbRes] = await Promise.all([
    supabase
      .from("operative_prompts")
      .select("id, name, objective, priority, is_active, tags")
      .eq("context", "command")
      .order("priority", { ascending: false }),
    supabase
      .from("kb_entries")
      .select("id, title, category, chapter, priority, is_active")
      .or("category.eq.command_tools,category.eq.ai_memory")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(50),
  ]);
  return {
    prompts: (promptsRes.data ?? []) as CommandHelpPromptRow[],
    kb: (kbRes.data ?? []) as CommandHelpKbRow[],
  };
}

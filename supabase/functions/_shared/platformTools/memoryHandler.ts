/**
 * memoryHandler.ts - Memory-related tool handlers
 * Handles: save, search
 */

import { supabase, escapeLike } from "./supabaseClient.ts";

export async function handleSaveMemory(
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const { data, error } = await supabase
    .from("ai_memory")
    .insert({
      user_id: userId,
      content: String(args.content),
      memory_type: String(args.memory_type || "fact"),
      tags: (args.tags as string[]) || [],
      importance: Math.min(5, Math.max(1, Number(args.importance) || 3)),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { success: true, memory_id: data.id };
}

export async function handleSearchMemory(
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  let query = supabase
    .from("ai_memory")
    .select("content, memory_type, tags, importance, created_at")
    .eq("user_id", userId)
    .order("importance", { ascending: false })
    .limit(Number(args.limit) || 10);
  if (args.tags && (args.tags as string[]).length > 0)
    query = query.overlaps("tags", args.tags as string[]);
  if (args.search_text)
    query = query.ilike("content", `%${escapeLike(String(args.search_text))}%`);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { count: data?.length || 0, memories: data || [] };
}

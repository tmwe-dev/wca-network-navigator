/**
 * tools/memory.ts — handler del dominio "ai_memory" per agent-execute.
 *
 * Estratto da `index.ts` in sessione #25. Contiene i case che leggono
 * o scrivono sulla tabella `ai_memory`.
 *
 * Richiede `userId` per isolare la memoria dell'utente corrente.
 *
 * Tool gestiti:
 *  - save_memory
 *  - search_memory
 */
import { escapeLike } from "../../_shared/sqlEscape.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export const MEMORY_TOOLS = new Set<string>([
  "save_memory",
  "search_memory",
]);

export async function executeMemoryTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  userId: string,
): Promise<unknown> {
  switch (name) {
    case "save_memory": {
      const { data, error } = await supabase.from("ai_memory").insert({
        user_id: userId,
        content: String(args.content),
        memory_type: String(args.memory_type || "fact"),
        tags: (args.tags as string[]) || [],
        importance: Math.min(5, Math.max(1, Number(args.importance) || 3)),
      }).select("id").single();
      if (error) return { error: error.message };
      return { success: true, memory_id: data.id };
    }

    case "search_memory": {
      let query = supabase.from("ai_memory").select("content, memory_type, tags, importance, created_at").eq("user_id", userId).order("importance", { ascending: false }).limit(Number(args.limit) || 10);
      if (args.tags && (args.tags as string[]).length > 0) query = query.overlaps("tags", args.tags as string[]);
      if (args.search_text) query = query.ilike("content", `%${escapeLike(String(args.search_text))}%`);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, memories: data || [] };
    }

    default:
      throw new Error(`executeMemoryTool: tool non gestito "${name}"`);
  }
}

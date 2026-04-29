/**
 * useCommandPromptsAndKb — load operative prompts (context=command) and KB
 * entries (category=command_tools) for the Command Help page.
 *
 * Read-only listing used to make Command's behavior transparent: which prompts
 * are active, and which KB cards inform its reasoning.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CommandPromptRow {
  readonly id: string;
  readonly name: string;
  readonly objective: string | null;
  readonly priority: number | null;
  readonly is_active: boolean | null;
  readonly tags: readonly string[] | null;
}

export interface CommandKbRow {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly chapter: string | null;
  readonly priority: number | null;
  readonly is_active: boolean | null;
}

export function useCommandPromptsAndKb() {
  return useQuery({
    queryKey: ["v2", "command", "help", "prompts-and-kb"],
    queryFn: async () => {
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
        prompts: (promptsRes.data ?? []) as CommandPromptRow[],
        kb: (kbRes.data ?? []) as CommandKbRow[],
      };
    },
    staleTime: 60_000,
  });
}
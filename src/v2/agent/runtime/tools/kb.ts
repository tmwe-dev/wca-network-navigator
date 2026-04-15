/**
 * KB tools — list and read knowledge base entries for the agent.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AgentTool, AgentToolResult } from "./index";

export const listKbTool: AgentTool = {
  name: "list_kb",
  description: "List all active KB entries with their categories, titles, and slugs.",
  parameters: {
    category: { type: "string", description: "Filter by category (optional)", required: false },
  },
  requiresApproval: false,
  execute: async (args): Promise<AgentToolResult> => {
    try {
      let query = supabase
        .from("kb_entries")
        .select("id, title, category, tags, source_path, priority")
        .eq("is_active", true)
        .order("priority", { ascending: false });

      if (args.category && typeof args.category === "string") {
        query = query.eq("category", args.category);
      }

      const { data, error } = await query.limit(50);
      if (error) return { success: false, error: error.message };

      return {
        success: true,
        data: (data ?? []).map((e) => ({
          id: e.id,
          title: e.title,
          category: e.category,
          tags: e.tags,
          sourcePath: e.source_path,
        })),
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export const readKbTool: AgentTool = {
  name: "read_kb",
  description: "Read the full content of a KB entry by source_path slug (e.g. 'kb-source/workflow/wf-create-campaign.md').",
  parameters: {
    source_path: { type: "string", description: "source_path or partial slug to match", required: true },
  },
  requiresApproval: false,
  execute: async (args): Promise<AgentToolResult> => {
    try {
      const slug = String(args.source_path ?? "");
      const { data, error } = await supabase
        .from("kb_entries")
        .select("id, title, content, category, tags")
        .or(`source_path.ilike.%${slug}%,title.ilike.%${slug}%`)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: `KB entry non trovata: ${slug}` };

      return {
        success: true,
        data: {
          title: data.title,
          category: data.category,
          tags: data.tags,
          content: (data.content ?? "").slice(0, 6000),
        },
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

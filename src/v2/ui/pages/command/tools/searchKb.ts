/**
 * Tool: search-kb — Searches the WCA Knowledge Base via full-text search.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tool, ToolResult } from "./types";

export const searchKbTool: Tool = {
  id: "search-kb",
  label: "Cerca nella knowledge base",
  description: "Cerca documentazione e workflow nella KB del sistema WCA",
  match: (prompt: string) =>
    /\b(kb|knowledge|documentazione|come\s+(si\s+)?fa|workflow|guida|manuale)\b/i.test(prompt),

  execute: async (prompt: string): Promise<ToolResult> => {
    const cleaned = prompt.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();

    const { data, error } = await supabase
      .from("kb_entries")
      .select("id, title, category, content, source_path, priority")
      .textSearch("content", cleaned, { type: "websearch", config: "italian" })
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);

    const results = data ?? [];

    if (results.length === 0) {
      // Fallback ilike on title
      const firstWord = cleaned.split(/\s+/).find((w) => w.length > 3);
      if (firstWord) {
        const { data: fallback } = await supabase
          .from("kb_entries")
          .select("id, title, category, content, source_path, priority")
          .ilike("title", `%${firstWord}%`)
          .eq("is_active", true)
          .order("priority", { ascending: false })
          .limit(20);

        if (fallback && fallback.length > 0) {
          return buildResult(fallback);
        }
      }

      return {
        kind: "table",
        title: "Knowledge Base · Nessun risultato",
        meta: { count: 0, sourceLabel: "Supabase · kb_entries" },
        columns: [{ key: "message", label: "Messaggio" }],
        rows: [{ message: "Nessuna entry trovata. Prova con termini diversi." }],
      };
    }

    return buildResult(results);
  },
};

function buildResult(
  results: Array<{
    id: string;
    title: string;
    category: string;
    content: string;
    source_path: string | null;
    priority: number;
  }>,
): ToolResult {
  return {
    kind: "table",
    title: "Knowledge Base · Risultati",
    meta: { count: results.length, sourceLabel: "Supabase · kb_entries" },
    columns: [
      { key: "title", label: "Titolo" },
      { key: "category", label: "Categoria" },
      { key: "source_path", label: "Fonte" },
      { key: "preview", label: "Anteprima" },
    ],
    rows: results.map((r) => ({
      title: r.title,
      category: r.category ?? "—",
      source_path: r.source_path ?? "—",
      preview: (r.content ?? "").slice(0, 120) + "…",
    })),
  };
}

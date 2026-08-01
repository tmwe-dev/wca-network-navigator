/**
 * Tool: create-kb-entry — Add a new KB entry (requires approval)
 */
import { createKbEntry } from "@/v2/io/supabase/mutations/kb-entries";
import { isOk } from "@/v2/core/domain/result";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractPayload(prompt: string): Record<string, unknown> {
  const titleMatch = prompt.match(/(?:titolo|title)\s+["']?([^"']+)/i);
  return {
    title: titleMatch?.[1]?.trim() ?? "",
    content: "",
    category: "general",
    tags: [],
  };
}

export const createKbEntryTool: Tool = {
  id: "create-kb-entry",
  label: "Aggiungi entry KB",
  description: "Aggiunge una nuova voce alla Knowledge Base del sistema",
  match: (p) => /(aggiungi|nuova).*(kb|knowledge)/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      const payload = extractPayload(prompt);
      return {
        kind: "approval",
        title: "Aggiungere entry alla KB?",
        description: "Una nuova voce verrà aggiunta alla Knowledge Base.",
        details: [
          { label: "Titolo", value: String(payload.title || "(da compilare)") },
          { label: "Categoria", value: String(payload.category) },
          { label: "Tags", value: "[]" },
        ],
        governance: { role: "ADMIN", permission: "WRITE:KB", policy: "POLICY v1.0 · SOFT-SYNC" },
        pendingPayload: payload,
        toolId: "create-kb-entry",
      };
    }

    const p = context.payload ?? {};
    const result = await createKbEntry({
      title: String(p.title ?? "Nuova entry"),
      content: String(p.content ?? ""),
      category: String(p.category ?? "general"),
      tags: Array.isArray(p.tags) ? p.tags as string[] : [],
    });

    if (!isOk(result)) throw new Error(result.error.message);

    return {
      kind: "result",
      title: "Entry KB creata",
      message: `Entry "${result.value.title}" aggiunta alla Knowledge Base.`,
      meta: { count: 1, sourceLabel: "Supabase · kb_entries" },
    };
  },
};

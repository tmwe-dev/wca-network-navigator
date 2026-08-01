/**
 * Tool: deep-search-partner — Read-only deep search per PARTNER (no WCA download).
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult } from "./types";

interface Resp {
  results?: Array<{ name?: string; country?: string; city?: string; website?: string; summary?: string; score?: number }>;
  message?: string;
  error?: string;
}

export const deepSearchPartnerTool: Tool = {
  id: "deep-search-partner",
  label: "Deep search partner",
  description: "Ricerca approfondita su un partner (web + KB locale). Non scarica nulla da WCA.",
  match: (p) => /\b(deep\s*search|approfondisci|investiga|sherlock)\b[^.]{0,40}\b(partner|azienda|company|fornitore)\b/i.test(p),

  execute: async (prompt): Promise<ToolResult> => {
    const q = prompt.replace(/^(deep\s*search|approfondisci|investiga|sherlock)\s*/i, "").trim();
    const res = await invokeEdge<Resp>("deep-search-partner", {
      body: { query: q || prompt },
      context: "command:deep-search-partner",
    });
    const rows = (res?.results ?? []).map((r, i) => ({
      id: String(i + 1),
      name: r.name ?? "—",
      location: [r.city, r.country].filter(Boolean).join(", ") || "—",
      website: r.website ?? "—",
      score: r.score ?? "—",
      summary: (r.summary ?? "").slice(0, 200),
    }));
    if (rows.length === 0) {
      return {
        kind: "result",
        title: "Deep search partner",
        message: res?.error ?? res?.message ?? "Nessun risultato.",
        meta: { count: 0, sourceLabel: "Edge · deep-search-partner" },
      };
    }
    return {
      kind: "table",
      title: `Deep search: ${q || "partner"}`,
      columns: [
        { key: "name", label: "Nome" },
        { key: "location", label: "Località" },
        { key: "website", label: "Sito" },
        { key: "score", label: "Score" },
        { key: "summary", label: "Sintesi" },
      ],
      rows,
      meta: { count: rows.length, sourceLabel: "Edge · deep-search-partner" },
    };
  },
};
/**
 * Tool: suggest-email-groups — Read-only. Clustering email per gruppi suggeriti.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult } from "./types";

interface Resp {
  groups?: Array<{ label?: string; pattern?: string; count?: number; sample?: string }>;
  message?: string;
  error?: string;
}

export const suggestEmailGroupsTool: Tool = {
  id: "suggest-email-groups",
  label: "Suggerisci gruppi email",
  description: "Analizza l'inbox e suggerisce raggruppamenti/regole automatiche.",
  match: (p) => /\b(suggerisci|proponi|raggruppa|cluster)\b[^.]{0,30}\b(email|inbox|mail|gruppi)\b/i.test(p),

  execute: async (): Promise<ToolResult> => {
    const res = await invokeEdge<Resp>("suggest-email-groups", {
      body: {},
      context: "command:suggest-email-groups",
    });
    const rows = (res?.groups ?? []).map((g, i) => ({
      id: String(i + 1),
      label: g.label ?? "—",
      pattern: g.pattern ?? "—",
      count: g.count ?? 0,
      sample: (g.sample ?? "").slice(0, 120),
    }));
    if (rows.length === 0) {
      return {
        kind: "result",
        title: "Suggerimenti gruppi email",
        message: res?.error ?? res?.message ?? "Nessun raggruppamento suggerito.",
        meta: { count: 0, sourceLabel: "Edge · suggest-email-groups" },
      };
    }
    return {
      kind: "table",
      title: "Gruppi email suggeriti",
      columns: [
        { key: "label", label: "Etichetta" },
        { key: "pattern", label: "Pattern" },
        { key: "count", label: "#" },
        { key: "sample", label: "Esempio" },
      ],
      rows,
      meta: { count: rows.length, sourceLabel: "Edge · suggest-email-groups" },
    };
  },
};
/**
 * Tool: optimus-analyze — Read-only. Analisi strategica multi-partner.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult } from "./types";

interface Resp {
  insights?: Array<{ heading?: string; body?: string }>;
  summary?: string;
  message?: string;
  error?: string;
}

export const optimusAnalyzeTool: Tool = {
  id: "optimus-analyze",
  label: "Analisi strategica (Optimus)",
  description: "Analisi cross-partner ad alto livello: trend, opportunità, rischi.",
  match: (p) => /\b(analisi\s+strategica|optimus|cross[-\s]?partner|trend\s+rete|opportunit[àa]\s+rete)\b/i.test(p),

  execute: async (prompt): Promise<ToolResult> => {
    const res = await invokeEdge<Resp>("optimus-analyze", {
      body: { query: prompt },
      context: "command:optimus-analyze",
    });
    const sections = (res?.insights ?? []).map((i) => ({
      heading: i.heading ?? "Insight",
      body: i.body ?? "",
    }));
    if (sections.length === 0 && res?.summary) {
      sections.push({ heading: "Sintesi", body: res.summary });
    }
    if (sections.length === 0) {
      return {
        kind: "result",
        title: "Analisi strategica",
        message: res?.error ?? res?.message ?? "Nessun insight prodotto.",
        meta: { count: 0, sourceLabel: "Edge · optimus-analyze" },
      };
    }
    return {
      kind: "report",
      title: "Analisi strategica (Optimus)",
      sections,
      meta: { count: sections.length, sourceLabel: "Edge · optimus-analyze" },
    };
  },
};
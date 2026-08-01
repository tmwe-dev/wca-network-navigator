/**
 * Tool: analyze-email-edit — Read-only. Analizza differenze tra bozza AI e versione operatore.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult } from "./types";

export const analyzeEmailEditTool: Tool = {
  id: "analyze-email-edit",
  label: "Analizza modifica email",
  description: "Compara bozza AI vs versione finale operatore: stile, tono, contenuto modificato.",
  match: (p) => /\b(analizza|confronta|diff)\b[^.]{0,30}\b(email|bozza|edit|modifica)\b/i.test(p)
    && /\b(ai|operatore|finale|originale)\b/i.test(p),

  execute: async (prompt): Promise<ToolResult> => {
    const res = await invokeEdge<{
      changes?: Array<{ kind?: string; before?: string; after?: string }>;
      summary?: string;
      error?: string;
    }>("analyze-email-edit", { body: { query: prompt }, context: "command:analyze-email-edit" });
    if (res?.error) {
      return {
        kind: "result",
        title: "Analisi non disponibile",
        message: res.error,
        meta: { count: 0, sourceLabel: "Edge · analyze-email-edit" },
      };
    }
    const sections: { heading: string; body: string }[] = [];
    if (res?.summary) sections.push({ heading: "Sintesi", body: res.summary });
    if (res?.changes?.length) {
      sections.push({
        heading: `Modifiche (${res.changes.length})`,
        body: res.changes.slice(0, 20).map((c) => `[${c.kind ?? "?"}]\n- ${c.before ?? ""}\n+ ${c.after ?? ""}`).join("\n\n"),
      });
    }
    if (sections.length === 0) sections.push({ heading: "Risultato", body: "Nessuna modifica rilevante rilevata." });
    return {
      kind: "report",
      title: "Analisi modifica email",
      sections,
      meta: { count: sections.length, sourceLabel: "Edge · analyze-email-edit" },
    };
  },
};
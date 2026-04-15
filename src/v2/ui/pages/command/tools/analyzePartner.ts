/**
 * Tool: analyze-partner — AI analysis of a partner via edge function
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tool, ToolResult } from "./types";

export const analyzePartnerTool: Tool = {
  id: "analyze-partner",
  label: "Analizza partner",
  description: "Esegue un'analisi AI approfondita di un partner WCA",
  match: (p) => /analizza partner/i.test(p),

  execute: async (prompt): Promise<ToolResult> => {
    const idMatch = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

    const { data, error } = await supabase.functions.invoke("analyze-partner", {
      body: { partnerId: idMatch?.[0] ?? "", query: prompt },
    });

    if (error) throw new Error(error.message);

    const sections = Array.isArray(data?.sections) ? data.sections : [
      { heading: "Analisi", body: typeof data?.analysis === "string" ? data.analysis : JSON.stringify(data ?? {}) },
    ];

    return {
      kind: "report",
      title: "Analisi Partner AI",
      sections: sections.map((s: Record<string, unknown>) => ({
        heading: String(s.heading ?? "Sezione"),
        body: String(s.body ?? s.content ?? ""),
      })),
      meta: { count: sections.length, sourceLabel: "Edge · analyze-partner" },
    };
  },
};

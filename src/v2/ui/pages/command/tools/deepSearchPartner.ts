/**
 * Tool: deep-search-partner — Deep search for partners via edge function
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tool, ToolResult } from "./types";

export const deepSearchPartnerTool: Tool = {
  id: "deep-search-partner",
  label: "Deep search partner",
  description: "Cerca in profondità partner nel database WCA e fonti esterne",
  match: (p) => /trova partner|cerca a fondo|deep.?search.*partner/i.test(p),

  execute: async (prompt): Promise<ToolResult> => {
    const { data, error } = await supabase.functions.invoke("deep-search-partner", {
      body: { query: prompt },
    });

    if (error) throw new Error(error.message);

    const results = Array.isArray(data?.results) ? data.results : [];

    return {
      kind: "table",
      title: "Deep Search Partner · Risultati",
      meta: { count: results.length, sourceLabel: "Edge · deep-search-partner" },
      columns: [
        { key: "companyName", label: "Azienda" },
        { key: "country", label: "Paese" },
        { key: "score", label: "Score" },
        { key: "source", label: "Fonte" },
      ],
      rows: results.map((r: Record<string, unknown>) => ({
        companyName: String(r.company_name ?? r.companyName ?? "—"),
        country: String(r.country ?? "—"),
        score: Number(r.score ?? r.confidence ?? 0),
        source: String(r.source ?? "WCA"),
      })),
    };
  },
};

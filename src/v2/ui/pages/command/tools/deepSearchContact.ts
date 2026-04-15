/**
 * Tool: deep-search-contact — Deep search for contacts via edge function
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tool, ToolResult } from "./types";

export const deepSearchContactTool: Tool = {
  id: "deep-search-contact",
  label: "Deep search contatto",
  description: "Cerca in profondità contatti nel database e fonti esterne",
  match: (p) => /trova contatto|deep.?search.*contatt/i.test(p),

  execute: async (prompt): Promise<ToolResult> => {
    const { data, error } = await supabase.functions.invoke("deep-search-contact", {
      body: { query: prompt },
    });

    if (error) throw new Error(error.message);

    const results = Array.isArray(data?.results) ? data.results : [];

    return {
      kind: "table",
      title: "Deep Search Contatto · Risultati",
      meta: { count: results.length, sourceLabel: "Edge · deep-search-contact" },
      columns: [
        { key: "name", label: "Nome" },
        { key: "company", label: "Azienda" },
        { key: "email", label: "Email" },
        { key: "source", label: "Fonte" },
      ],
      rows: results.map((r: Record<string, unknown>) => ({
        name: String(r.name ?? "—"),
        company: String(r.company_name ?? r.company ?? "—"),
        email: String(r.email ?? "—"),
        source: String(r.source ?? "CRM"),
      })),
    };
  },
};

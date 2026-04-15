/**
 * Tool: prospect-search — Search prospects
 */
import { fetchProspects } from "@/v2/io/supabase/queries/prospects";
import { isOk } from "@/v2/core/domain/result";
import type { Tool, ToolResult } from "./types";

export const prospectSearchTool: Tool = {
  id: "prospect-search",
  label: "Cerca prospect",
  description: "Cerca prospect nel database",
  match: (p) => /prospect/i.test(p),

  execute: async (): Promise<ToolResult> => {
    const result = await fetchProspects();
    const prospects = isOk(result) ? result.value : [];

    return {
      kind: "table",
      title: "Prospect · Risultati",
      meta: { count: prospects.length, sourceLabel: "Supabase · prospects" },
      columns: [
        { key: "companyName", label: "Azienda" },
        { key: "region", label: "Regione" },
        { key: "city", label: "Città" },
      ],
      rows: prospects.map(p => ({
        companyName: p.companyName ?? "—",
        region: p.region ?? "—",
        city: p.city ?? "—",
      })),
    };
  },
};

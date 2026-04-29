/**
 * Tool: wca-country-counts — Read-only. Conteggi partner per paese (no download).
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult } from "./types";

interface Resp {
  counts?: Array<{ country?: string; total?: number; active?: number; new_30d?: number }>;
  message?: string;
  error?: string;
}

export const wcaCountryCountsTool: Tool = {
  id: "wca-country-counts",
  label: "Conteggi partner per paese",
  description: "Mostra distribuzione partner per paese (totali, attivi, nuovi 30gg). Solo lettura locale.",
  match: (p) => /\b(conteggi|counts?|distribuzione|breakdown|quanti\s+partner)\b[^.]{0,30}\b(paes[ie]|country|countries|nazion[ie])\b/i.test(p),

  execute: async (): Promise<ToolResult> => {
    const res = await invokeEdge<Resp>("wca-country-counts", {
      body: {},
      context: "command:wca-country-counts",
    });
    const rows = (res?.counts ?? []).map((c, i) => ({
      id: String(i + 1),
      country: c.country ?? "—",
      total: c.total ?? 0,
      active: c.active ?? 0,
      new_30d: c.new_30d ?? 0,
    }));
    if (rows.length === 0) {
      return {
        kind: "result",
        title: "Conteggi paese",
        message: res?.error ?? res?.message ?? "Nessun dato disponibile.",
        meta: { count: 0, sourceLabel: "Edge · wca-country-counts" },
      };
    }
    return {
      kind: "table",
      title: "Distribuzione partner per paese",
      columns: [
        { key: "country", label: "Paese" },
        { key: "total", label: "Totale" },
        { key: "active", label: "Attivi" },
        { key: "new_30d", label: "Nuovi 30g" },
      ],
      rows,
      meta: { count: rows.length, sourceLabel: "Edge · wca-country-counts" },
    };
  },
};
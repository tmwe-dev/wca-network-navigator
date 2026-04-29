/**
 * Tool: daily-briefing — Read-only morning brief from edge `daily-briefing`.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult } from "./types";

interface BriefingResp {
  summary?: string;
  briefing?: string;
  highlights?: string[];
  kpi?: Record<string, number | string>;
  sections?: { heading: string; body: string }[];
  message?: string;
  error?: string;
}

export const dailyBriefingTool: Tool = {
  id: "daily-briefing",
  label: "Briefing giornaliero",
  description: "Genera il briefing operativo della giornata: KPI, scadenze, code, missioni, inbox.",
  match: (p) => /\b(briefing|brief|riepilogo\s+giornaliero|sintesi\s+giornaliera|cosa\s+devo\s+fare\s+oggi|agenda\s+oggi|stato\s+oggi)\b/i.test(p),

  execute: async (): Promise<ToolResult> => {
    const res = await invokeEdge<BriefingResp>("daily-briefing", {
      body: {},
      context: "command:daily-briefing",
    });

    if (!res || res.error) {
      return {
        kind: "result",
        title: "Briefing non disponibile",
        message: res?.error ?? "Errore nel generare il briefing.",
        meta: { count: 0, sourceLabel: "Edge · daily-briefing" },
      };
    }

    const sections = res.sections && res.sections.length > 0
      ? res.sections
      : [
          { heading: "Sintesi", body: res.summary ?? res.briefing ?? res.message ?? "Nessun contenuto disponibile." },
          ...(res.highlights && res.highlights.length > 0
            ? [{ heading: "Highlights", body: res.highlights.map((h) => `• ${h}`).join("\n") }]
            : []),
          ...(res.kpi
            ? [{ heading: "KPI", body: Object.entries(res.kpi).map(([k, v]) => `${k}: ${v}`).join("\n") }]
            : []),
        ];

    return {
      kind: "report",
      title: "Briefing giornaliero",
      sections,
      meta: { count: sections.length, sourceLabel: "Edge · daily-briefing" },
    };
  },
};
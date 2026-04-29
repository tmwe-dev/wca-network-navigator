/**
 * Tool: health-check — Read-only. Diagnostica sistema e integrazioni.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult } from "./types";

interface Resp {
  status?: string;
  components?: Record<string, { status?: string; detail?: string }>;
  message?: string;
  error?: string;
}

export const healthCheckTool: Tool = {
  id: "health-check",
  label: "Diagnostica sistema",
  description: "Verifica lo stato di edge functions, DB, integrazioni email/extension.",
  match: (p) => /\b(health\s*check|diagnos(?:i|tica)|status\s+sistema|stato\s+(?:del\s+)?sistema|tutto\s+ok)\b/i.test(p),

  execute: async (): Promise<ToolResult> => {
    const res = await invokeEdge<Resp>("health-check", {
      body: {},
      context: "command:health-check",
    });
    const sections: { heading: string; body: string }[] = [];
    sections.push({ heading: "Stato globale", body: res?.status ?? res?.message ?? "—" });
    if (res?.components) {
      const body = Object.entries(res.components)
        .map(([k, v]) => `${k}: ${v?.status ?? "?"}${v?.detail ? ` — ${v.detail}` : ""}`)
        .join("\n");
      sections.push({ heading: "Componenti", body });
    }
    if (res?.error) sections.push({ heading: "Errore", body: res.error });
    return {
      kind: "report",
      title: "Diagnostica sistema",
      sections,
      meta: { count: sections.length, sourceLabel: "Edge · health-check" },
    };
  },
};
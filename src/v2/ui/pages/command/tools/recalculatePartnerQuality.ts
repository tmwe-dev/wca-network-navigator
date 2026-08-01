/**
 * Tool: recalculate-partner-quality — Write/approval (heavy compute). Edge `recalculate-partner-quality`.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult, ToolContext } from "./types";

export const recalculatePartnerQualityTool: Tool = {
  id: "recalculate-partner-quality",
  label: "Ricalcola quality score partner",
  description: "Ricalcola il quality_score per tutti i partner (o filtrati). Operazione massiva.",
  match: (p) => /\b(ricalcola|recalc(?:ulate)?|aggiorna)\b[^.]{0,30}\b(quality|qualit[àa]\s+score|punteggio\s+partner)\b/i.test(p),

  execute: async (_prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Ricalcolare quality score di tutti i partner?",
        description: "Operazione massiva. Aggiorna il campo quality_score in base a integrazione dati e attività recenti.",
        details: [
          { label: "Scope", value: "all partners" },
          { label: "Costo stimato", value: "1 batch worker" },
        ],
        governance: { role: "DIRETTORE", permission: "WRITE:PARTNERS_QUALITY", policy: "POLICY v1.0 · QUALITY-RECOMPUTE" },
        pendingPayload: {},
        toolId: "recalculate-partner-quality",
      };
    }
    const res = await invokeEdge<{ updated?: number; message?: string; error?: string }>(
      "recalculate-partner-quality",
      { body: {}, context: "command:recalculate-partner-quality" },
    );
    return {
      kind: "result",
      title: res?.error ? "Ricalcolo fallito" : "Quality score aggiornato",
      message: res?.error ?? res?.message ?? `Partner aggiornati: ${res?.updated ?? 0}`,
      meta: { count: res?.updated ?? 0, sourceLabel: "Edge · recalculate-partner-quality" },
    };
  },
};
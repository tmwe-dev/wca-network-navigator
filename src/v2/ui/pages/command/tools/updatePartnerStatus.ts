/**
 * Tool: update-partner-status — Update partner status (requires approval)
 */
import { updatePartner } from "@/v2/io/supabase/mutations/partners";
import { isOk } from "@/v2/core/domain/result";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractPayload(prompt: string): Record<string, unknown> {
  const idMatch = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const statusMatch = prompt.match(/(?:stato|status)\s+["']?(\w+)/i);
  return {
    id: idMatch?.[0] ?? "",
    lead_status: statusMatch?.[1]?.toLowerCase() ?? "",
  };
}

export const updatePartnerStatusTool: Tool = {
  id: "update-partner-status",
  label: "Aggiorna stato partner",
  description: "Cambia lo stato commerciale di un partner WCA",
  match: (p) => /(marca|imposta|cambia stato).*partner/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      const payload = extractPayload(prompt);
      return {
        kind: "approval",
        title: "Aggiornare stato partner?",
        description: "Lo stato commerciale del partner verrà modificato.",
        details: [
          { label: "ID Partner", value: String(payload.id || "(seleziona partner)") },
          { label: "Nuovo stato", value: String(payload.lead_status || "(da specificare)") },
        ],
        governance: { role: "COMMERCIALE", permission: "WRITE:PARTNERS", policy: "POLICY v1.0 · SOFT-SYNC" },
        pendingPayload: payload,
        toolId: "update-partner-status",
      };
    }

    const p = context.payload ?? {};
    const id = String(p.id ?? "");
    if (!id) throw new Error("ID partner mancante");

    const result = await updatePartner(id, {
      lead_status: String(p.lead_status ?? ""),
    });

    if (!isOk(result)) throw new Error(result.error.message);

    return {
      kind: "result",
      title: "Stato partner aggiornato",
      message: `Partner aggiornato a stato "${p.lead_status}".`,
      meta: { count: 1, sourceLabel: "Supabase · partners" },
    };
  },
};

/**
 * Tool: create-partner — Create a new WCA partner (requires approval)
 */
import { createPartner } from "@/v2/io/supabase/mutations/partners";
import { isOk } from "@/v2/core/domain/result";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractPayload(prompt: string): Record<string, unknown> {
  const nameMatch = prompt.match(/(?:partner|azienda)\s+["']?([A-Z][\w\s]+)/i);
  return {
    company_name: nameMatch?.[1]?.trim() ?? "",
    country_name: "",
    country_code: "",
    city: "",
  };
}

export const createPartnerTool: Tool = {
  id: "create-partner",
  label: "Crea partner",
  description: "Crea un nuovo partner WCA nel database",
  match: (p) => /(crea|aggiungi)\s+partner/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      const payload = extractPayload(prompt);
      return {
        kind: "approval",
        title: "Creare nuovo partner?",
        description: "Il partner verrà aggiunto al database WCA.",
        details: [
          { label: "Nome azienda", value: String(payload.company_name || "(da compilare)") },
          { label: "Paese", value: String(payload.country_name || "(da compilare)") },
          { label: "Città", value: String(payload.city || "(da compilare)") },
        ],
        governance: { role: "ADMIN", permission: "WRITE:PARTNERS", policy: "POLICY v1.0 · SOFT-SYNC" },
        pendingPayload: payload,
        toolId: "create-partner",
      };
    }

    const p = context.payload ?? {};
    const result = await createPartner({
      company_name: String(p.company_name ?? ""),
      country_name: String(p.country_name ?? ""),
      country_code: String(p.country_code ?? ""),
      city: String(p.city ?? ""),
    });

    if (!isOk(result)) throw new Error(result.error.message);

    return {
      kind: "result",
      title: "Partner creato",
      message: `Partner "${result.value.companyName}" creato con successo.`,
      meta: { count: 1, sourceLabel: "Supabase · partners" },
    };
  },
};

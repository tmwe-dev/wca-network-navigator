/**
 * Tool: create-campaign — Create a campaign job (requires approval)
 */
import { createCampaignJob } from "@/v2/io/supabase/mutations/campaigns";
import { isOk } from "@/v2/core/domain/result";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractPayload(prompt: string): Record<string, unknown> {
  const nameMatch = prompt.match(/campagna\s+["']?([^"']+)/i);
  return {
    company_name: nameMatch?.[1]?.trim() ?? "Nuova campagna",
    batch_id: "",
    partner_id: "",
    country_code: "",
    country_name: "",
  };
}

export const createCampaignTool: Tool = {
  id: "create-campaign",
  label: "Crea campagna",
  description: "Crea un nuovo job di campagna outreach",
  match: (p) => /(crea|lancia|nuova)\s+campagna/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      const payload = extractPayload(prompt);
      return {
        kind: "approval",
        title: "Creare nuova campagna?",
        description: "Un nuovo job di campagna verrà creato nel sistema.",
        details: [
          { label: "Nome", value: String(payload.company_name) },
          { label: "Batch", value: String(payload.batch_id || "(da assegnare)") },
          { label: "Paese", value: String(payload.country_name || "(da specificare)") },
        ],
        governance: { role: "ADMIN", permission: "WRITE:CAMPAIGNS", policy: "POLICY v1.0 · SOFT-SYNC" },
        pendingPayload: payload,
        toolId: "create-campaign",
      };
    }

    const p = context.payload ?? {};
    const result = await createCampaignJob({
      company_name: String(p.company_name ?? ""),
      batch_id: String(p.batch_id ?? "manual"),
      partner_id: String(p.partner_id ?? ""),
      country_code: String(p.country_code ?? ""),
      country_name: String(p.country_name ?? ""),
    });

    if (!isOk(result)) throw new Error(result.error.message);

    return {
      kind: "result",
      title: "Campagna creata",
      message: `Job campagna creato con successo.`,
      meta: { count: 1, sourceLabel: "Supabase · campaign_jobs" },
    };
  },
};

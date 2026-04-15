/**
 * Tool: enqueue-outreach — Enqueue outreach items (requires approval)
 */
import { enqueueOutreach } from "@/v2/io/supabase/mutations/outreach-queue";
import { isOk } from "@/v2/core/domain/result";
import type { Tool, ToolResult, ToolContext } from "./types";

export const enqueueOutreachTool: Tool = {
  id: "enqueue-outreach",
  label: "Programma outreach",
  description: "Programma e schedula attività di outreach per i contatti selezionati",
  match: (p) => /(invia|programma|schedula).*outreach/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Programmare outreach?",
        description: "Gli item verranno aggiunti alla coda di outreach per l'invio.",
        details: [
          { label: "Azione", value: "Aggiunta alla coda outreach" },
          { label: "Contatti", value: "(selezionare contatti)" },
        ],
        governance: { role: "COMMERCIALE", permission: "EXECUTE:OUTREACH", policy: "POLICY v1.0 · SOFT-SYNC" },
        pendingPayload: { items: [] },
        toolId: "enqueue-outreach",
      };
    }

    const p = context.payload ?? {};
    const items = Array.isArray(p.items) ? p.items : [];
    if (items.length === 0) throw new Error("Nessun item da accodare");

    const result = await enqueueOutreach(items as never[]);
    if (!isOk(result)) throw new Error(result.error.message);

    return {
      kind: "result",
      title: "Outreach programmato",
      message: `${items.length} item aggiunti alla coda di outreach.`,
      meta: { count: items.length, sourceLabel: "Supabase · email_campaign_queue" },
    };
  },
};

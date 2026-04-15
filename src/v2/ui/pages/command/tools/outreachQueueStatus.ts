/**
 * Tool: outreach-queue — Show outreach queue status
 */
import { fetchOutreachQueue } from "@/v2/io/supabase/queries/outreach-queue";
import { isOk } from "@/v2/core/domain/result";
import type { Tool, ToolResult } from "./types";

export const outreachQueueStatusTool: Tool = {
  id: "outreach-queue",
  label: "Coda outreach",
  description: "Mostra la coda di outreach in attesa e in corso",
  match: (p) => /coda|outreach|in attesa|pending/i.test(p) && !/campagn|email|componi/i.test(p),

  execute: async (): Promise<ToolResult> => {
    const result = await fetchOutreachQueue();
    const items = isOk(result) ? result.value : [];

    return {
      kind: "table",
      title: "Coda Outreach · Stato",
      meta: { count: items.length, sourceLabel: "Supabase · email_campaign_queue" },
      columns: [
        { key: "position", label: "#" },
        { key: "contactName", label: "Contatto" },
        { key: "status", label: "Stato" },
        { key: "templateId", label: "Template" },
      ],
      rows: items.map((item) => ({
        position: item.position ?? 0,
        contactName: item.contactName ?? "—",
        status: item.status ?? "pending",
        templateId: item.templateId ?? "—",
      })),
    };
  },
};

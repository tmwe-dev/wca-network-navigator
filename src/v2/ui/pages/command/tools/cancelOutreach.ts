/**
 * Tool: cancel-outreach-item — cancella o posticipa un item della coda outreach.
 */
import type { Tool, ToolResult, ToolContext } from "./types";
import { updateOutreachItem } from "@/data/outreachQueue";
import { mergePayload, isUuid } from "./_helpers/writePayload";

type Payload = { item_id?: string; action?: "cancel" | "postpone"; new_scheduled_at?: string; [k: string]: unknown };

export const cancelOutreachItemTool: Tool = {
  id: "cancel-outreach-item",
  label: "Cancella/posticipa outreach",
  description: "Cancella o riprogramma un item nella coda outreach",
  match: (p) => /\b(cancella|annulla|posticipa|rimanda)\b.*\boutreach/i.test(p),
  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const id = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
    const postpone = /\bposticipa|rimanda\b/i.test(prompt);
    const payload = mergePayload<Payload>(context?.payload, {
      item_id: id,
      action: postpone ? "postpone" : "cancel",
    });
    const itemId = String(payload.item_id ?? "").trim();
    const action = payload.action ?? "cancel";
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: action === "cancel" ? "Annullare item outreach?" : "Posticipare item outreach?",
        description: action === "cancel" ? "L'item verrà annullato dalla coda." : "L'item verrà riprogrammato.",
        details: [
          { label: "Item", value: itemId || "(mancante)" },
          { label: "Azione", value: action },
          ...(payload.new_scheduled_at ? [{ label: "Nuova data", value: payload.new_scheduled_at }] : []),
        ],
        governance: { role: "operator", permission: "WRITE:OUTREACH", policy: "outreach-cancel" },
        pendingPayload: payload,
        toolId: "cancel-outreach-item",
      };
    }
    if (!itemId || !isUuid(itemId)) throw new Error("item_id mancante o invalido");
    const patch: Record<string, unknown> =
      action === "cancel"
        ? { status: "cancelled" }
        : { scheduled_at: payload.new_scheduled_at ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString() };
    await updateOutreachItem(itemId, patch);
    return {
      kind: "result",
      title: action === "cancel" ? "🚫 Outreach annullato" : "⏰ Outreach riprogrammato",
      message: `Item ${itemId.slice(0, 8)}… aggiornato.`,
      meta: { count: 1, sourceLabel: "Supabase · outreach_queue" },
    };
  },
};

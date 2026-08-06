/**
 * Tool: close-activity — marca un'attività come completata (o annullata).
 * Payload atteso dal planner: { activity_id?: string, activity_ref?: string, status?: "completed"|"cancelled", note?: string }
 */
import type { Tool, ToolResult, ToolContext } from "./types";
import { findActivityRef, patchActivity } from "@/data/activities";
import { mergePayload, isUuid } from "./_helpers/writePayload";

type Payload = {
  activity_id?: string;
  activity_ref?: string;
  status?: "completed" | "cancelled";
  note?: string;
  [k: string]: unknown;
};

function fallbackFromPrompt(prompt: string): Payload {
  const idMatch = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const cancelled = /\b(annull|cancell)/i.test(prompt);
  return {
    activity_id: idMatch?.[0],
    status: cancelled ? "cancelled" : "completed",
  };
}

async function resolveActivity(ref: string): Promise<{ id: string; title: string } | null> {
  if (!ref) return null;
  return findActivityRef(ref, isUuid(ref));
}

export const closeActivityTool: Tool = {
  id: "close-activity",
  label: "Chiudi attività",
  description: "Chiude (completa o annulla) un'attività dell'agenda operatore",
  match: (p) => /\b(chiudi|completa|marca\s+(come\s+)?fatt|annulla|cancella)\s+(l')?attivit/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const payload = mergePayload<Payload>(context?.payload, fallbackFromPrompt(prompt));
    const ref = String(payload.activity_id || payload.activity_ref || "").trim();
    const status = payload.status === "cancelled" ? "cancelled" : "completed";

    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: status === "cancelled" ? "Annullare attività?" : "Completare attività?",
        description: "L'attività verrà aggiornata nell'agenda operatore.",
        details: [
          { label: "Attività", value: ref || "(riferimento mancante)" },
          { label: "Nuovo stato", value: status },
          ...(payload.note ? [{ label: "Nota", value: payload.note }] : []),
        ],
        governance: { role: "operator", permission: "WRITE:ACTIVITIES", policy: "agenda-close" },
        pendingPayload: { ...payload, status },
        toolId: "close-activity",
      };
    }

    if (!ref) throw new Error("Riferimento attività mancante");
    const resolved = await resolveActivity(ref);
    if (!resolved) throw new Error(`Attività "${ref}" non trovata`);

    await patchActivity(resolved.id, {
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      ...(payload.note ? { description: payload.note } : {}),
    });

    return {
      kind: "result",
      title: status === "completed" ? "✅ Attività completata" : "🚫 Attività annullata",
      message: `"${resolved.title}" aggiornata a stato ${status}.`,
      meta: { count: 1, sourceLabel: "Supabase · activities" },
    };
  },
};

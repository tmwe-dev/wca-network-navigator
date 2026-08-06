/**
 * Tool: reschedule-activity — sposta la scadenza di un'attività.
 * Payload atteso: { activity_id?: string, activity_ref?: string, dueAt: string (ISO o YYYY-MM-DD), note?: string }
 */
import type { Tool, ToolResult, ToolContext } from "./types";
import { findActivityRef, patchActivity } from "@/data/activities";
import { mergePayload, isUuid } from "./_helpers/writePayload";

type Payload = {
  activity_id?: string;
  activity_ref?: string;
  dueAt?: string;
  note?: string;
  [k: string]: unknown;
};

function fallbackFromPrompt(prompt: string): Payload {
  const idMatch = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const dateMatch = prompt.match(/\b(\d{4}-\d{2}-\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2})?)?\b/);
  return { activity_id: idMatch?.[0], dueAt: dateMatch?.[0] };
}

async function resolveActivity(ref: string): Promise<{ id: string; title: string } | null> {
  if (!ref) return null;
  return findActivityRef(ref, isUuid(ref));
}

export const rescheduleActivityTool: Tool = {
  id: "reschedule-activity",
  label: "Sposta attività",
  description: "Modifica la scadenza di un'attività in agenda",
  match: (p) => /\b(sposta|rischedul|riprogramma|rimanda|posticipa)\b.*attivit|\battivit.*\b(al|per il)\b/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const payload = mergePayload<Payload>(context?.payload, fallbackFromPrompt(prompt));
    const ref = String(payload.activity_id || payload.activity_ref || "").trim();
    const dueAt = (payload.dueAt ?? "").trim();

    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Riprogrammare attività?",
        description: "La scadenza dell'attività verrà aggiornata.",
        details: [
          { label: "Attività", value: ref || "(riferimento mancante)" },
          { label: "Nuova scadenza", value: dueAt || "(data mancante)" },
          ...(payload.note ? [{ label: "Nota", value: payload.note }] : []),
        ],
        governance: { role: "operator", permission: "WRITE:ACTIVITIES", policy: "agenda-reschedule" },
        pendingPayload: payload,
        toolId: "reschedule-activity",
      };
    }

    if (!ref) throw new Error("Riferimento attività mancante");
    if (!dueAt) throw new Error("Nuova data mancante");
    const resolved = await resolveActivity(ref);
    if (!resolved) throw new Error(`Attività "${ref}" non trovata`);

    await patchActivity(resolved.id, {
      due_date: dueAt.slice(0, 10),
      scheduled_at: dueAt.length > 10 ? dueAt : `${dueAt.slice(0, 10)}T09:00:00Z`,
      status: "pending",
      ...(payload.note ? { description: payload.note } : {}),
    });

    return {
      kind: "result",
      title: "📅 Attività riprogrammata",
      message: `"${resolved.title}" spostata al ${dueAt}.`,
      meta: { count: 1, sourceLabel: "Supabase · activities" },
    };
  },
};

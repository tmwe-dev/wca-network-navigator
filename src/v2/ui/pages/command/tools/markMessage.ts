/**
 * Tool: mark-message — segna un messaggio come letto/non-letto o assegna categoria.
 * Payload atteso: { message_id?: string, action?: "read"|"unread"|"category", category?: string }
 */
import type { Tool, ToolResult, ToolContext } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { mergePayload, isUuid } from "./_helpers/writePayload";

type Payload = {
  message_id?: string;
  action?: "read" | "unread" | "category";
  category?: string;
  [k: string]: unknown;
};

function fallbackFromPrompt(prompt: string): Payload {
  const idMatch = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const unread = /\bnon\s*letto\b|\bunread\b/i.test(prompt);
  const cat = prompt.match(/\bcategoria\s+([\w-]+)/i);
  return {
    message_id: idMatch?.[0],
    action: cat ? "category" : unread ? "unread" : "read",
    category: cat?.[1],
  };
}

export const markMessageTool: Tool = {
  id: "mark-message",
  label: "Marca messaggio",
  description: "Segna un messaggio come letto/non-letto o gli assegna una categoria",
  match: (p) => /\b(segna|marca|contrassegna)\b.*(messaggio|mail|email)/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const payload = mergePayload<Payload>(context?.payload, fallbackFromPrompt(prompt));
    const id = String(payload.message_id ?? "").trim();
    const action = payload.action ?? "read";

    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Aggiornare messaggio?",
        description: "Verrà aggiornato lo stato del messaggio selezionato.",
        details: [
          { label: "Messaggio", value: id || "(id mancante)" },
          { label: "Azione", value: action },
          ...(payload.category ? [{ label: "Categoria", value: payload.category }] : []),
        ],
        governance: { role: "operator", permission: "WRITE:MESSAGES", policy: "mark-message" },
        pendingPayload: payload,
        toolId: "mark-message",
      };
    }

    if (!id || !isUuid(id)) throw new Error("message_id mancante o non valido");

    let updatePromise;
    if (action === "read") {
      updatePromise = supabase.from("channel_messages").update({ read_at: new Date().toISOString() }).eq("id", id);
    } else if (action === "unread") {
      updatePromise = supabase.from("channel_messages").update({ read_at: null }).eq("id", id);
    } else {
      if (!payload.category) throw new Error("Categoria mancante");
      updatePromise = supabase.from("channel_messages").update({ category: payload.category }).eq("id", id);
    }
    const { error } = await updatePromise;
    if (error) throw new Error(error.message);

    return {
      kind: "result",
      title: "✉️ Messaggio aggiornato",
      message: `Azione "${action}" applicata${payload.category ? ` (categoria=${payload.category})` : ""}.`,
      meta: { count: 1, sourceLabel: "Supabase · channel_messages" },
    };
  },
};
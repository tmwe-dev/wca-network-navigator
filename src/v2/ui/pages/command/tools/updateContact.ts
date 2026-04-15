/**
 * Tool: update-contact — Update an existing contact (requires approval)
 */
import { updateContact } from "@/v2/io/supabase/mutations/contacts";
import { isOk } from "@/v2/core/domain/result";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractPayload(prompt: string): Record<string, unknown> {
  const idMatch = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return {
    id: idMatch?.[0] ?? "",
    updates: {},
  };
}

export const updateContactTool: Tool = {
  id: "update-contact",
  label: "Aggiorna contatto",
  description: "Aggiorna un contatto esistente nel CRM",
  match: (p) => /(aggiorna|modifica)\s+contatt/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      const payload = extractPayload(prompt);
      return {
        kind: "approval",
        title: "Aggiornare contatto?",
        description: "Le modifiche verranno applicate al contatto selezionato.",
        details: [
          { label: "ID contatto", value: String(payload.id || "(seleziona contatto)") },
          { label: "Modifiche", value: "Da specificare" },
        ],
        governance: { role: "COMMERCIALE", permission: "WRITE:CONTACTS", policy: "POLICY v1.0 · SOFT-SYNC" },
        pendingPayload: payload,
        toolId: "update-contact",
      };
    }

    const p = context.payload ?? {};
    const id = String(p.id ?? "");
    if (!id) throw new Error("ID contatto mancante");

    const updates = (p.updates as Record<string, unknown>) ?? {};
    const result = await updateContact(id, updates);

    if (!isOk(result)) throw new Error(result.error.message);

    return {
      kind: "result",
      title: "Contatto aggiornato",
      message: `Contatto aggiornato con successo.`,
      meta: { count: 1, sourceLabel: "Supabase · imported_contacts" },
    };
  },
};

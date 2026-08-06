/**
 * Tool: restore-contact — ripristina un contatto soft-deleted.
 */
import type { Tool, ToolResult, ToolContext } from "./types";
import { restoreContactById, restoreContactByTerm } from "@/data/commandRestoreContact";
import { mergePayload, isUuid } from "./_helpers/writePayload";

type Payload = { contact_id?: string; contact_ref?: string; [k: string]: unknown };

export const restoreContactTool: Tool = {
  id: "restore-contact",
  label: "Ripristina contatto",
  description: "Ripristina un contatto dal cestinone",
  match: (p) => /\b(ripristina|recupera|restore)\s+contatt/i.test(p),
  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const id = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
    const email = prompt.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];
    const payload = mergePayload<Payload>(context?.payload, { contact_id: id, contact_ref: email });
    const ref = String(payload.contact_id || payload.contact_ref || "").trim();
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Ripristinare contatto?",
        description: "Il contatto tornerà visibile nel CRM.",
        details: [{ label: "Contatto", value: ref || "(mancante)" }],
        governance: { role: "operator", permission: "WRITE:CONTACTS", policy: "contact-restore" },
        pendingPayload: payload,
        toolId: "restore-contact",
      };
    }
    if (!ref) throw new Error("Riferimento contatto mancante");
    const { error, count } = isUuid(ref) ? await restoreContactById(ref) : await restoreContactByTerm(ref);
    if (error) throw new Error(error.message);
    return {
      kind: "result",
      title: "♻️ Contatto ripristinato",
      message: `${count ?? 0} contatto ripristinato.`,
      meta: { count: count ?? 0, sourceLabel: "Supabase · imported_contacts" },
    };
  },
};

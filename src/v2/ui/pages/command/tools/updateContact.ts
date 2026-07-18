/**
 * Tool: update-contact — Update an existing contact (requires approval).
 *
 * Accetta dal planner:
 *   - { contact_id | contact_ref | name | email, updates: {...} }
 * Fallback regex per input umano diretto.
 */
import { updateContact } from "@/v2/io/supabase/mutations/contacts";
import { isOk } from "@/v2/core/domain/result";
import type { Tool, ToolResult, ToolContext } from "./types";
import { mergePayload, resolveContactRef, isUuid } from "./_helpers/writePayload";

function fallbackFromPrompt(prompt: string): Record<string, unknown> {
  const idMatch = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const emailMatch = prompt.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return {
    contact_id: idMatch?.[0] ?? "",
    contact_ref: emailMatch?.[0] ?? "",
    updates: {},
  };
}

function pickRef(p: Record<string, unknown>): string {
  return String(p.contact_id || p.contact_ref || p.name || p.email || "").trim();
}

function describeUpdates(updates: Record<string, unknown>): string {
  const keys = Object.keys(updates ?? {});
  if (keys.length === 0) return "(nessun campo)";
  return keys.map((k) => `${k}=${String(updates[k])}`).join(", ");
}

export const updateContactTool: Tool = {
  id: "update-contact",
  label: "Aggiorna contatto",
  description: "Aggiorna un contatto esistente nel CRM",
  match: (p) => /(aggiorna|modifica)\s+contatt/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const payload = mergePayload(context?.payload, fallbackFromPrompt(prompt));
    const ref = pickRef(payload);
    const updates = (payload.updates as Record<string, unknown>) ?? {};

    if (!context?.confirmed) {
      let displayName = ref;
      if (ref && !isUuid(ref)) {
        const resolved = await resolveContactRef(ref);
        if (resolved) displayName = `${resolved.name} (${resolved.id.slice(0, 8)}…)`;
      }
      return {
        kind: "approval",
        title: "Aggiornare contatto?",
        description: "Le modifiche verranno applicate al contatto selezionato.",
        details: [
          { label: "Contatto", value: displayName || "(seleziona contatto)" },
          { label: "Modifiche", value: describeUpdates(updates) },
        ],
        governance: { role: "COMMERCIALE", permission: "WRITE:CONTACTS", policy: "POLICY v1.0 · SOFT-SYNC" },
        pendingPayload: payload,
        toolId: "update-contact",
      };
    }

    if (!ref) throw new Error("Riferimento contatto mancante (contact_id / contact_ref / email)");
    if (!updates || Object.keys(updates).length === 0) throw new Error("Nessuna modifica da applicare (updates vuoto)");

    const resolved = await resolveContactRef(ref);
    if (!resolved) throw new Error(`Contatto "${ref}" non trovato`);

    const result = await updateContact(resolved.id, updates);
    if (!isOk(result)) throw new Error(result.error.message);

    return {
      kind: "result",
      title: "Contatto aggiornato",
      message: `${resolved.name}: ${describeUpdates(updates)}.`,
      meta: { count: 1, sourceLabel: "Supabase · imported_contacts" },
    };
  },
};

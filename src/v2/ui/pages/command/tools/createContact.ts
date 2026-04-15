/**
 * Tool: create-contact — Create a new contact (requires approval)
 */
import { createContact } from "@/v2/io/supabase/mutations/contacts";
import { isOk } from "@/v2/core/domain/result";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractPayload(prompt: string): Record<string, unknown> {
  const emailMatch = prompt.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const nameMatch = prompt.match(/(?:nome|contatto)\s+["']?([A-Z][\w\s]+)/i);
  const companyMatch = prompt.match(/(?:azienda|company)\s+["']?([A-Z][\w\s]+)/i);
  return {
    name: nameMatch?.[1]?.trim() ?? "",
    email: emailMatch?.[0] ?? "",
    company_name: companyMatch?.[1]?.trim() ?? "",
    country: "",
    lead_status: "new",
    import_log_id: "00000000-0000-0000-0000-000000000000",
  };
}

export const createContactTool: Tool = {
  id: "create-contact",
  label: "Crea contatto",
  description: "Crea un nuovo contatto nel CRM",
  match: (p) => /(crea|aggiungi|nuovo)\s+contatt/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      const payload = extractPayload(prompt);
      return {
        kind: "approval",
        title: "Creare nuovo contatto?",
        description: "Il contatto verrà aggiunto al database CRM.",
        details: [
          { label: "Nome", value: String(payload.name || "(da compilare)") },
          { label: "Email", value: String(payload.email || "(da compilare)") },
          { label: "Azienda", value: String(payload.company_name || "(da compilare)") },
          { label: "Stato", value: "new" },
        ],
        governance: { role: "COMMERCIALE", permission: "WRITE:CONTACTS", policy: "POLICY v1.0 · SOFT-SYNC" },
        pendingPayload: payload,
        toolId: "create-contact",
      };
    }

    const p = context.payload ?? {};
    const result = await createContact({
      import_log_id: String(p.import_log_id ?? "00000000-0000-0000-0000-000000000000"),
      name: String(p.name ?? ""),
      email: String(p.email ?? ""),
      company_name: String(p.company_name ?? ""),
      country: String(p.country ?? ""),
      lead_status: String(p.lead_status ?? "new"),
    });

    if (!isOk(result)) throw new Error(result.error.message);

    return {
      kind: "result",
      title: "Contatto creato",
      message: `Contatto "${result.value.name ?? ""}" creato con successo.`,
      meta: { count: 1, sourceLabel: "Supabase · imported_contacts" },
    };
  },
};

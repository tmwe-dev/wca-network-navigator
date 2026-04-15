/**
 * Tool: contact-search — Search contacts in imported_contacts
 */
import { fetchContacts } from "@/v2/io/supabase/queries/contacts";
import { isOk } from "@/v2/core/domain/result";
import type { Tool, ToolResult } from "./types";

export const contactSearchTool: Tool = {
  id: "contact-search",
  label: "Cerca contatti",
  description: "Cerca contatti, clienti e lead nel database CRM",
  match: (p) => /contatt|cliente|lead/i.test(p) && !/inattiv|crea|aggiorna|elimina|modifica/i.test(p),

  execute: async (prompt): Promise<ToolResult> => {
    const words = prompt.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(w => w.length > 3);
    const search = words.slice(0, 3).join(" ") || undefined;

    const result = await fetchContacts({ search, limit: 25 });
    const contacts = isOk(result) ? result.value : [];

    return {
      kind: "table",
      title: "Contatti · Risultati",
      meta: { count: contacts.length, sourceLabel: "Supabase · imported_contacts" },
      columns: [
        { key: "name", label: "Nome" },
        { key: "company", label: "Azienda" },
        { key: "email", label: "Email" },
        { key: "country", label: "Paese" },
        { key: "lead_status", label: "Stato" },
      ],
      rows: contacts.map(c => ({
        name: c.name ?? "—",
        company: c.companyName ?? "—",
        email: c.email ?? "—",
        country: c.country ?? "—",
        lead_status: c.leadStatus ?? "new",
      })),
    };
  },
};

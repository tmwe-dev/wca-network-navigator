/**
 * Tool: link-contact-partner — associa un contatto a un partner.
 * Payload atteso: { contact_id?, contact_ref?, partner_id?, partner_ref?, confidence?: number }
 */
import type { Tool, ToolResult, ToolContext } from "./types";
import { linkContactToPartner } from "@/application/data/contacts";
import { mergePayload, resolveContactRef, resolvePartnerRef } from "./_helpers/writePayload";

type Payload = {
  contact_id?: string;
  contact_ref?: string;
  partner_id?: string;
  partner_ref?: string;
  confidence?: number;
  [k: string]: unknown;
};

function fallbackFromPrompt(prompt: string): Payload {
  const uuids = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? [];
  return { contact_id: uuids[0], partner_id: uuids[1] };
}

export const linkContactPartnerTool: Tool = {
  id: "link-contact-partner",
  label: "Collega contatto → partner",
  description: "Associa un contatto a un partner del CRM",
  match: (p) => /\b(collega|associa|linka|assegna)\b.*\bcontatt.*\b(a|al|con)\b.*\bpartner/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const payload = mergePayload<Payload>(context?.payload, fallbackFromPrompt(prompt));
    const contactRef = String(payload.contact_id || payload.contact_ref || "").trim();
    const partnerRef = String(payload.partner_id || payload.partner_ref || "").trim();

    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Collegare contatto a partner?",
        description: "Il contatto verrà associato al partner selezionato nel CRM.",
        details: [
          { label: "Contatto", value: contactRef || "(mancante)" },
          { label: "Partner", value: partnerRef || "(mancante)" },
        ],
        governance: { role: "COMMERCIALE", permission: "WRITE:CONTACTS", policy: "link-contact-partner" },
        pendingPayload: payload,
        toolId: "link-contact-partner",
      };
    }

    if (!contactRef || !partnerRef) throw new Error("Servono sia contatto che partner");
    const contact = await resolveContactRef(contactRef);
    if (!contact) throw new Error(`Contatto "${contactRef}" non trovato`);
    const partner = await resolvePartnerRef(partnerRef);
    if (!partner) throw new Error(`Partner "${partnerRef}" non trovato`);

    await linkContactToPartner(contact.id, partner.id);

    return {
      kind: "result",
      title: "🔗 Contatto collegato",
      message: `${contact.name} → ${partner.company_name}.`,
      meta: { count: 1, sourceLabel: "Supabase · imported_contacts" },
    };
  },
};

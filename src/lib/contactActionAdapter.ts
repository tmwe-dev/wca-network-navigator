import type { CockpitContact } from "@/hooks/useCockpitContacts";

/**
 * Adapts an imported contact record to the CockpitContact shape
 * needed by ContactActionMenu.
 */
export function adaptImportedContact(c: any): CockpitContact {
  const ed = c.enrichment_data || {};
  return {
    id: c.id,
    queueId: c.id, // no queue row — use contact id
    name: c.contact_alias || c.name || "",
    company: c.company_alias || c.company_name || "",
    role: c.position || "",
    country: c.country || "",
    language: "",
    lastContact: c.last_interaction_at || "",
    priority: 5,
    channels: [
      c.email ? "email" : "",
      ed?.linkedin_url ? "linkedin" : "",
      c.phone || c.mobile ? "whatsapp" : "",
    ].filter(Boolean),
    email: c.email || "",
    phone: c.phone || c.mobile || "",
    origin: (c.origin || "import") as any,
    originDetail: c.origin || "import",
    sourceType: "imported_contact",
    sourceId: c.id,
    partnerId: c.wca_partner_id || null,
    linkedinUrl: ed?.linkedin_url || "",
    deepSearchAt: c.deep_search_at || undefined,
    enrichmentData: ed,
    leadStatus: c.lead_status,
  };
}

/**
 * Adapts a business card record to the CockpitContact shape.
 */
export function adaptBusinessCard(card: any): CockpitContact {
  return {
    id: card.id,
    queueId: card.id,
    name: card.contact_name || "",
    company: card.company_name || "",
    role: card.position || "",
    country: "",
    language: "",
    lastContact: "",
    priority: 5,
    channels: [
      card.email ? "email" : "",
      card.phone || card.mobile ? "whatsapp" : "",
    ].filter(Boolean),
    email: card.email || "",
    phone: card.mobile || card.phone || "",
    origin: "bca" as any,
    originDetail: "Biglietto da visita",
    sourceType: "business_card",
    sourceId: card.id,
    partnerId: card.matched_partner_id || null,
    linkedinUrl: "",
    leadStatus: card.lead_status,
  };
}

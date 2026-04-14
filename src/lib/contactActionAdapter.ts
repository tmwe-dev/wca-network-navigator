import type { CockpitContact } from "@/hooks/useCockpitContacts";
import type { ContactOrigin } from "@/pages/Cockpit";

export interface ImportedContactRecord {
  id: string;
  contact_alias?: string | null;
  name?: string | null;
  company_alias?: string | null;
  company_name?: string | null;
  position?: string | null;
  country?: string | null;
  city?: string | null;
  last_interaction_at?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  origin?: string | null;
  wca_partner_id?: string | null;
  deep_search_at?: string | null;
  enrichment_data?: Record<string, unknown> | null;
  lead_status?: string | null;
  lead_score?: number | null;
  lead_score_breakdown?: Record<string, unknown> | null;
  interaction_count?: number | null;
}

interface BusinessCardRecord {
  id: string;
  contact_name?: string | null;
  company_name?: string | null;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  matched_partner_id?: string | null;
  lead_status?: string;
}

/**
 * Adapts an imported contact record to the CockpitContact shape
 * needed by ContactActionMenu.
 */
export function adaptImportedContact(c: ImportedContactRecord): CockpitContact {
  const ed = c.enrichment_data || {};
  return {
    id: c.id,
    queueId: c.id,
    name: c.contact_alias || c.name || "",
    company: c.company_alias || c.company_name || "",
    role: c.position || "",
    country: c.country || "",
    language: "",
    lastContact: c.last_interaction_at || "",
    priority: 5,
    channels: [
      c.email ? "email" : "",
      (ed as Record<string, unknown>)?.linkedin_url ? "linkedin" : "",
      c.phone || c.mobile ? "whatsapp" : "",
    ].filter(Boolean),
    email: c.email || "",
    phone: c.phone || c.mobile || "",
    origin: (c.origin || "import") as ContactOrigin,
    originDetail: c.origin || "import",
    sourceType: "imported_contact",
    sourceId: c.id,
    partnerId: c.wca_partner_id || null,
    linkedinUrl: ((ed as Record<string, unknown>)?.linkedin_url as string) || "",
    deepSearchAt: c.deep_search_at || undefined,
    enrichmentData: ed,
    leadStatus: c.lead_status ?? undefined,
  };
}

/**
 * Adapts a business card record to the CockpitContact shape.
 */
export function adaptBusinessCard(card: BusinessCardRecord): CockpitContact {
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
    origin: "bca" as ContactOrigin,
    originDetail: "Biglietto da visita",
    sourceType: "business_card",
    sourceId: card.id,
    partnerId: card.matched_partner_id || null,
    linkedinUrl: "",
    leadStatus: card.lead_status,
  };
}

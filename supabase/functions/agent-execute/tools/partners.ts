/**
 * tools/partners.ts — handler del dominio "partners" per agent-execute
 *
 * Estratto da `index.ts` in sessione #24 (Ondata 2, Fase 4 Vol. I — split
 * dei file monolitici). Contiene SOLO i case che operano primariamente
 * sulla tabella `partners` (read, write, bulk update).
 *
 * I case che toccano i partner solo come join secondario (es.
 * `deep_search_partner`, `enrich_partner_website`, `manage_partner_contact`,
 * `scan_directory`) restano in `index.ts` in attesa di moduli dedicati
 * (directory, enrichment, contacts).
 *
 * Tool gestiti qui:
 *  - search_partners
 *  - get_partner_detail
 *  - get_partners_without_contacts
 *  - update_partner
 *  - add_partner_note
 *  - bulk_update_partners
 *
 * Il consumatore (`index.ts`) delega via `PARTNER_TOOLS.has(name)` prima
 * dello switch generale.
 */
import { escapeLike } from "../../_shared/sqlEscape.ts";
import { resolvePartnerId } from "./shared.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export const PARTNER_TOOLS = new Set<string>([
  "search_partners",
  "get_partner_detail",
  "get_partners_without_contacts",
  "update_partner",
  "add_partner_note",
  "bulk_update_partners",
]);

export async function executePartnerTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<unknown> {
  switch (name) {
    case "search_partners": {
      const isCount = !!args.count_only;
      let query = supabase.from("partners").select(
        isCount ? "id" : "id, company_name, city, country_code, country_name, email, phone, rating, wca_id, website, raw_profile_html, is_favorite, office_type, lead_status",
        isCount ? { count: "exact", head: true } : undefined
      );
      if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
      if (args.city) query = query.ilike("city", `%${escapeLike(String(args.city))}%`);
      if (args.search_name) query = query.ilike("company_name", `%${escapeLike(String(args.search_name))}%`);
      if (args.has_email === true) query = query.not("email", "is", null);
      if (args.has_profile === true) query = query.not("raw_profile_html", "is", null);
      if (args.has_profile === false) query = query.is("raw_profile_html", null);
      if (args.min_rating) query = query.gte("rating", Number(args.min_rating));
      if (args.office_type) query = query.eq("office_type", args.office_type);
      if (args.is_favorite === true) query = query.eq("is_favorite", true);
      query = query.order("rating", { ascending: false, nullsFirst: false }).limit(Math.min(Number(args.limit) || 20, 50));
      const { data, error, count } = await query;
      if (error) return { error: error.message };
      if (isCount) return { count };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { count: data?.length, partners: (data || []).map((p: any) => ({ id: p.id, company_name: p.company_name, city: p.city, country_code: p.country_code, country_name: p.country_name, email: p.email, rating: p.rating, has_profile: !!p.raw_profile_html, lead_status: p.lead_status })) };
    }

    case "get_partner_detail": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let partner: any = null;
      if (args.partner_id) { const { data } = await supabase.from("partners").select("*").eq("id", args.partner_id).single(); partner = data; }
      else if (args.company_name) { const { data } = await supabase.from("partners").select("*").ilike("company_name", `%${escapeLike(String(args.company_name))}%`).limit(1).single(); partner = data; }
      if (!partner) return { error: "Partner non trovato" };
      const [contactsRes, networksRes, servicesRes] = await Promise.all([
        supabase.from("partner_contacts").select("name, email, title, direct_phone, mobile, is_primary").eq("partner_id", partner.id),
        supabase.from("partner_networks").select("network_name, expires").eq("partner_id", partner.id),
        supabase.from("partner_services").select("service_category").eq("partner_id", partner.id),
      ]);
      return {
        id: partner.id, company_name: partner.company_name, city: partner.city, country_code: partner.country_code,
        email: partner.email, phone: partner.phone, website: partner.website, rating: partner.rating,
        lead_status: partner.lead_status, has_profile: !!partner.raw_profile_html,
        profile_summary: partner.raw_profile_markdown?.substring(0, 1500) || null,
        contacts: contactsRes.data || [], networks: networksRes.data || [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        services: (servicesRes.data || []).map((s: any) => s.service_category),
      };
    }

    case "get_partners_without_contacts": {
      let query = supabase.from("partners_no_contacts").select("wca_id, company_name, city, country_code, retry_count").eq("resolved", false).limit(Number(args.limit) || 30);
      if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, partners: data || [] };
    }

    case "update_partner": {
      const partner = await resolvePartnerId(supabase, args);
      if (!partner) return { error: "Partner non trovato" };
      const updates: Record<string, unknown> = {};
      if (args.is_favorite !== undefined) updates.is_favorite = args.is_favorite;
      if (args.lead_status) updates.lead_status = args.lead_status;
      if (args.rating !== undefined) updates.rating = Math.min(5, Math.max(0, Number(args.rating)));
      if (args.company_alias) updates.company_alias = args.company_alias;
      if (Object.keys(updates).length === 0) return { error: "Nessun campo da aggiornare" };
      updates.updated_at = new Date().toISOString();
      const { error } = await supabase.from("partners").update(updates).eq("id", partner.id);
      if (error) return { error: error.message };
      return { success: true, partner: partner.name, message: `Partner "${partner.name}" aggiornato.` };
    }

    case "add_partner_note": {
      const partner = await resolvePartnerId(supabase, args);
      if (!partner) return { error: "Partner non trovato" };
      const { error } = await supabase.from("interactions").insert({ partner_id: partner.id, interaction_type: String(args.interaction_type || "note"), subject: String(args.subject), notes: args.notes ? String(args.notes) : null });
      if (error) return { error: error.message };
      return { success: true, message: `Nota aggiunta a "${partner.name}".` };
    }

    case "bulk_update_partners": {
      const updates: Record<string, unknown> = {};
      if (args.is_favorite !== undefined) updates.is_favorite = args.is_favorite;
      if (args.lead_status) updates.lead_status = args.lead_status;
      if (Object.keys(updates).length === 0) return { error: "Nessun aggiornamento" };
      updates.updated_at = new Date().toISOString();
      let query = supabase.from("partners").update(updates);
      if (args.partner_ids) query = query.in("id", args.partner_ids as string[]);
      else if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
      else return { error: "Specifica country_code o partner_ids" };
      const { error } = await query;
      if (error) return { error: error.message };
      return { success: true, message: "Partner aggiornati." };
    }

    default:
      throw new Error(`executePartnerTool: tool non gestito "${name}"`);
  }
}

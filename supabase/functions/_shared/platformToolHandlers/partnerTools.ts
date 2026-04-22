/**
 * partnerTools.ts — Partner search, detail, update handlers.
 */
import { escapeLike } from "../sqlEscape.ts";
import { supabase, resolvePartnerId, type PartnerSummary, type CountryStatRow } from "../platformToolHelpers.ts";

export async function executePartnerToolHandler(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  authHeader: string,
): Promise<unknown> {
  switch (name) {
    case "search_partners": {
      const isCount = !!args.count_only;
      let query = supabase.from("partners").select(
        isCount
          ? "id"
          : "id, company_name, city, country_code, country_name, email, phone, rating, wca_id, website, profile_description, is_favorite, office_type, lead_status",
        isCount ? { count: "exact", head: true } : undefined,
      );
      if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
      if (args.city) query = query.ilike("city", `%${escapeLike(String(args.city))}%`);
      if (args.search_name) query = query.ilike("company_name", `%${escapeLike(String(args.search_name))}%`);
      if (args.has_email === true) query = query.not("email", "is", null);
      if (args.has_profile === true) query = query.not("profile_description", "is", null);
      if (args.has_profile === false) query = query.is("profile_description", null);
      if (args.min_rating) query = query.gte("rating", Number(args.min_rating));
      if (args.office_type) query = query.eq("office_type", args.office_type);
      if (args.is_favorite === true) query = query.eq("is_favorite", true);
      query = query
        .order("rating", { ascending: false, nullsFirst: false })
        .limit(Math.min(Number(args.limit) || 20, 50));
      const { data, error, count } = await query;
      if (error) return { error: error.message };
      if (isCount) return { count };
      return {
        count: data?.length,
        partners: (data || []).map(
          (p: {
            id: string;
            company_name: string;
            city: string;
            country_code: string;
            country_name: string;
            email: string | null;
            rating: number | null;
            profile_description: string | null;
            lead_status: string | null;
          }) => ({
            id: p.id,
            company_name: p.company_name,
            city: p.city,
            country_code: p.country_code,
            country_name: p.country_name,
            email: p.email,
            rating: p.rating,
            has_profile: !!p.profile_description,
            lead_status: p.lead_status,
          }),
        ),
      };
    }

    case "get_partner_detail": {
      let partner: PartnerSummary | null = null;
      if (args.partner_id) {
        const { data } = await supabase
          .from("partners")
          .select("*")
          .eq("id", args.partner_id)
          .single();
        partner = data as PartnerSummary | null;
      } else if (args.company_name) {
        const { data } = await supabase
          .from("partners")
          .select("*")
          .ilike("company_name", `%${escapeLike(String(args.company_name))}%`)
          .limit(1)
          .single();
        partner = data as PartnerSummary | null;
      }
      if (!partner) return { error: "Partner non trovato" };
      const [contactsRes, networksRes, servicesRes] = await Promise.all([
        supabase
          .from("partner_contacts")
          .select("name, email, title, direct_phone, mobile, is_primary")
          .eq("partner_id", partner.id),
        supabase.from("partner_networks").select("network_name, expires").eq("partner_id", partner.id),
        supabase.from("partner_services").select("service_category").eq("partner_id", partner.id),
      ]);
      return {
        id: partner.id,
        company_name: partner.company_name,
        city: partner.city,
        country_code: partner.country_code,
        email: partner.email,
        phone: partner.phone,
        website: partner.website,
        rating: partner.rating,
        lead_status: partner.lead_status,
        has_profile: !!partner.raw_profile_html,
        profile_summary: partner.raw_profile_markdown?.substring(0, 1500) || null,
        contacts: contactsRes.data || [],
        networks: networksRes.data || [],
        services: (servicesRes.data || []).map((s: { service_category: string }) => s.service_category),
      };
    }

    case "get_country_overview": {
      const { data, error } = await supabase.rpc("get_country_stats");
      if (error) return { error: error.message };
      let stats = (data || []) as CountryStatRow[];
      if (args.country_code) stats = stats.filter((s) => s.country_code === String(args.country_code).toUpperCase());
      stats.sort((a, b) => (b.total_partners || 0) - (a.total_partners || 0));
      return {
        total_countries: stats.length,
        countries: stats.slice(0, Number(args.limit) || 30).map((s) => ({
          country_code: s.country_code,
          total_partners: s.total_partners,
          with_profile: s.with_profile,
          without_profile: s.without_profile,
          with_email: s.with_email,
          with_phone: s.with_phone,
        })),
      };
    }

    case "update_partner": {
      const partner = await resolvePartnerId(args);
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
      const partner = await resolvePartnerId(args);
      if (!partner) return { error: "Partner non trovato" };
      const { error } = await supabase.from("interactions").insert({
        partner_id: partner.id,
        interaction_type: String(args.interaction_type || "note"),
        subject: String(args.subject),
        notes: args.notes ? String(args.notes) : null,
      });
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
      return { error: `Unknown partner tool: ${name}` };
  }
}

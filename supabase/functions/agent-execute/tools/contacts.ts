/**
 * tools/contacts.ts — handler del dominio "contacts & prospects" per
 * agent-execute.
 *
 * Estratto da `index.ts` in sessione #24 (Ondata 2, Fase 4 Vol. I — split
 * dei file monolitici). Contiene i case che operano su `imported_contacts`
 * e `prospects`.
 *
 * Tool gestiti:
 *  - search_contacts
 *  - get_contact_detail
 *  - search_prospects
 */
import { escapeLike } from "../../_shared/sqlEscape.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export const CONTACT_TOOLS = new Set<string>([
  "search_contacts",
  "get_contact_detail",
  "search_prospects",
]);

export async function executeContactTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<unknown> {
  switch (name) {
    case "search_contacts": {
      const isCount = !!args.count_only;
      let query = supabase.from("imported_contacts").select(isCount ? "id" : "id, name, company_name, email, phone, country, lead_status, created_at", isCount ? { count: "exact", head: true } : undefined);
      if (args.search_name) query = query.ilike("name", `%${escapeLike(String(args.search_name))}%`);
      if (args.company_name) query = query.ilike("company_name", `%${escapeLike(String(args.company_name))}%`);
      if (args.country) query = query.ilike("country", `%${escapeLike(String(args.country))}%`);
      if (args.lead_status) query = query.eq("lead_status", args.lead_status);
      if (args.has_email === true) query = query.not("email", "is", null);
      query = query.or("company_name.not.is.null,name.not.is.null,email.not.is.null");
      query = query.order("created_at", { ascending: false }).limit(Math.min(Number(args.limit) || 20, 50));
      const { data, error, count } = await query;
      if (error) return { error: error.message };
      if (isCount) return { count };
      return { count: data?.length || 0, contacts: data || [] };
    }

    case "get_contact_detail": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let contact: any = null;
      if (args.contact_id) { const { data } = await supabase.from("imported_contacts").select("*").eq("id", args.contact_id).single(); contact = data; }
      else if (args.contact_name) { const { data } = await supabase.from("imported_contacts").select("*").ilike("name", `%${escapeLike(String(args.contact_name))}%`).limit(1).single(); contact = data; }
      if (!contact) return { error: "Contatto non trovato" };
      return contact;
    }

    case "search_prospects": {
      let query = supabase.from("prospects").select("id, company_name, city, province, codice_ateco, fatturato, email, lead_status");
      if (args.company_name) query = query.ilike("company_name", `%${escapeLike(String(args.company_name))}%`);
      if (args.city) query = query.ilike("city", `%${escapeLike(String(args.city))}%`);
      if (args.codice_ateco) query = query.ilike("codice_ateco", `%${escapeLike(String(args.codice_ateco))}%`);
      if (args.lead_status) query = query.eq("lead_status", args.lead_status);
      query = query.order("fatturato", { ascending: false, nullsFirst: false }).limit(Math.min(Number(args.limit) || 20, 50));
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, prospects: data || [] };
    }

    default:
      throw new Error(`executeContactTool: tool non gestito "${name}"`);
  }
}

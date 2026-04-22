/**
 * prospectTools.ts — Italian prospect search handler.
 */
import { escapeLike } from "../sqlEscape.ts";
import { supabase } from "../platformToolHelpers.ts";

export async function executeProspectToolHandler(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  authHeader: string,
): Promise<unknown> {
  switch (name) {
    case "search_prospects": {
      let query = supabase.from("prospects").select("id, company_name, city, province, codice_ateco, fatturato, email, lead_status");
      if (args.company_name) query = query.ilike("company_name", `%${escapeLike(String(args.company_name))}%`);
      if (args.city) query = query.ilike("city", `%${escapeLike(String(args.city))}%`);
      if (args.province) query = query.ilike("province", `%${escapeLike(String(args.province))}%`);
      if (args.lead_status) query = query.eq("lead_status", args.lead_status);
      if (args.min_fatturato) query = query.gte("fatturato", Number(args.min_fatturato));
      query = query.limit(Math.min(Number(args.limit) || 20, 50));
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, prospects: data || [] };
    }

    default:
      return { error: `Unknown prospect tool: ${name}` };
  }
}

/**
 * searchTools.ts — Directory status and deep search handlers.
 */
import { supabase, type CountryStatRow, type DirectoryCountRow } from "../platformToolHelpers.ts";

export async function executeSearchToolHandler(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  authHeader: string,
): Promise<unknown> {
  switch (name) {
    case "get_directory_status": {
      const { data: dirData } = await supabase.rpc("get_directory_counts");
      const { data: statsData } = await supabase.rpc("get_country_stats");
      const dirMap: Record<string, number> = {};
      for (const r of (dirData || []) as DirectoryCountRow[]) dirMap[r.country_code] = Number(r.member_count);
      const statsMap: Record<string, CountryStatRow> = {};
      for (const r of (statsData || []) as CountryStatRow[]) statsMap[r.country_code] = r;
      if (args.country_code) {
        const code = String(args.country_code).toUpperCase();
        return {
          country_code: code,
          directory_members: dirMap[code] || 0,
          db_partners: statsMap[code]?.total_partners || 0,
          gap: (dirMap[code] || 0) - (statsMap[code]?.total_partners || 0),
        };
      }
      const allCodes = [...new Set([...Object.keys(dirMap), ...Object.keys(statsMap)])];
      const gaps = allCodes
        .map((c) => ({
          country_code: c,
          dir: dirMap[c] || 0,
          db: statsMap[c]?.total_partners || 0,
          gap: (dirMap[c] || 0) - (statsMap[c]?.total_partners || 0),
        }))
        .filter((r) => r.gap > 0)
        .sort((a, b) => b.gap - a.gap);
      return { countries_with_gaps: gaps.length, gaps: gaps.slice(0, 30) };
    }

    case "deep_search_partner": {
      // Sherlock è il motore unico (client-side, 3 livelli Scout/Detective/Sherlock).
      // L'agente AI server-side non può lanciarlo: restituisce snapshot + indirizzo UI.
      let pid = args.partner_id as string;
      if (!pid && args.company_name) {
        const { data } = await supabase.from("partners").select("id, company_name").ilike("company_name", `%${args.company_name}%`).limit(1).maybeSingle();
        if (data) pid = data.id;
      }
      if (!pid) return { error: "Partner non trovato" };
      const { data: p } = await supabase.from("partners").select("company_name, enrichment_data").eq("id", pid).maybeSingle();
      const ed = (p?.enrichment_data as Record<string, unknown>) || {};
      return {
        success: true,
        partner_id: pid,
        company_name: p?.company_name ?? null,
        deep_search_at: ed.deep_search_at ?? null,
        suggestion: `Sherlock è l'unico motore di Deep Search. Apri Email Forge → tab Deep Search e scegli il livello: Scout (rapido), Detective (medio), Sherlock (completo).`,
      };
    }

    case "deep_search_contact": {
      let cid = args.contact_id as string;
      if (!cid && args.contact_name) {
        const { data } = await supabase.from("imported_contacts").select("id, name").ilike("name", `%${args.contact_name}%`).limit(1).maybeSingle();
        if (data) cid = data.id;
      }
      if (!cid) return { error: "Contatto non trovato" };
      const { data: c } = await supabase.from("imported_contacts").select("id, name, deep_search_at").eq("id", cid).maybeSingle();
      return {
        success: true,
        contact_id: cid,
        name: c?.name ?? null,
        deep_search_at: c?.deep_search_at ?? null,
        suggestion: `Sherlock è l'unico motore di Deep Search contatto. Apri Email Forge → tab Deep Search (Scout/Detective/Sherlock).`,
      };
    }

    default:
      return { error: `Unknown search tool: ${name}` };
  }
}

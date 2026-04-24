/**
 * partnerLookup.ts — Partner and company name lookup helpers.
 * Shared utility functions for resolving partner IDs from company names.
 */

import { escapeLike } from "../../_shared/sqlEscape.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.39.3").createClient<any>>;

/**
 * Resolve WCA ID from company name and location via DB query.
 */
export async function resolveWcaId(
  supabase: SupabaseClient,
  companyName: string,
  city: string | null,
  countryCode: string | null,
): Promise<number | null> {
  let query = supabase
    .from("partners")
    .select(
      "id, wca_id, company_name, city, country_code, country_name, raw_profile_html",
    )
    .ilike("company_name", `%${escapeLike(companyName)}%`);
  if (countryCode) query = query.eq("country_code", countryCode);
  if (city) query = query.ilike("city", `%${escapeLike(city)}%`);
  const { data: found } = await query.limit(5);

  if (!found || found.length === 0) return null;

  const exact = (found as Record<string, unknown>[]).find(
    (p) =>
      String(p.company_name).toLowerCase() === companyName.toLowerCase(),
  ) || (found[0] as Record<string, unknown>);

  if (exact.raw_profile_html) {
    return null;
  }

  return exact.wca_id as number | null;
}

/**
 * Resolve WCA ID from company name via directory cache.
 */
export async function resolveWcaIdFromCache(
  supabase: SupabaseClient,
  companyName: string,
  countryCode: string | null,
): Promise<number | null> {
  let cacheQuery = supabase
    .from("directory_cache")
    .select("members, country_code");
  if (countryCode) cacheQuery = cacheQuery.eq("country_code", countryCode);
  const { data: cacheRows } = await cacheQuery;

  if (!cacheRows) return null;

  for (const row of cacheRows) {
    const members = row.members as Record<string, unknown>[];
    if (!Array.isArray(members)) continue;
    const match = members.find((m: Record<string, unknown>) => {
      const name = typeof m === "object"
        ? String(m.company_name || m.name || "")
        : "";
      return name.toLowerCase().includes(companyName.toLowerCase());
    });
    if (match) {
      const wcaId = typeof match === "object"
        ? Number(
          (match as Record<string, unknown>).wca_id ||
            (match as Record<string, unknown>).id,
        )
        : Number(match);
      if (wcaId) return wcaId;
    }
  }
  return null;
}

/**
 * Resolve country code and name from WCA ID.
 */
export async function resolveCountry(
  supabase: SupabaseClient,
  wcaId: number,
  fallbackCode?: string,
): Promise<{ code: string; name: string }> {
  const { data: p } = await supabase
    .from("partners")
    .select("country_code, country_name")
    .eq("wca_id", wcaId)
    .single();

  if (p) {
    return {
      code: (p as Record<string, unknown>).country_code as string,
      name: (p as Record<string, unknown>).country_name as string,
    };
  }

  return { code: fallbackCode || "XX", name: "Sconosciuto" };
}

/**
 * Resolve country name from country code.
 */
export async function resolveCountryName(
  supabase: SupabaseClient,
  countryCode: string,
): Promise<string> {
  const { data: p } = await supabase
    .from("partners")
    .select("country_name")
    .eq("country_code", countryCode)
    .limit(1)
    .single();
  return (
    ((p as Record<string, unknown> | null)?.country_name as string) ||
    countryCode
  );
}

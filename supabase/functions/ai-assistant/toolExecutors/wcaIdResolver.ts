/**
 * wcaIdResolver.ts — WCA ID resolution helpers for download jobs.
 * Shared utility functions for resolving partner IDs from various sources.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.39.3").createClient<any>>;

/**
 * Load partner WCA IDs based on mode (new, no_profile, all).
 */
export async function loadWcaIds(
  supabase: SupabaseClient,
  countryCode: string,
  mode: string,
  deadIdSet: Set<number>,
): Promise<number[]> {
  let wcaIds: number[] = [];

  if (mode === "new") {
    const { data: cacheRows } = await supabase
      .from("directory_cache")
      .select("members")
      .eq("country_code", countryCode);
    if (!cacheRows || cacheRows.length === 0) return [];

    const dirIds: number[] = [];
    for (const row of cacheRows) {
      const members = row.members as Record<string, unknown>[];
      if (Array.isArray(members)) {
        for (const m of members) {
          const id = typeof m === "object"
            ? ((m as Record<string, unknown>).wca_id ||
              (m as Record<string, unknown>).id)
            : m;
          if (id) dirIds.push(Number(id));
        }
      }
    }
    const { data: existing } = await supabase
      .from("partners")
      .select("wca_id")
      .eq("country_code", countryCode)
      .not("wca_id", "is", null);
    const existingSet = new Set(
      (existing || []).map((p: Record<string, unknown>) => p.wca_id),
    );
    wcaIds = [...new Set(dirIds)].filter(
      (id) => !existingSet.has(id) && !deadIdSet.has(id),
    );
  } else if (mode === "no_profile") {
    const { data: noProfile } = await supabase
      .from("partners")
      .select("wca_id")
      .eq("country_code", countryCode)
      .not("wca_id", "is", null)
      .is("raw_profile_html", null);
    wcaIds = (noProfile || [])
      .map((p: Record<string, unknown>) => p.wca_id as number)
      .filter(Boolean);

    const { data: cacheRows } = await supabase
      .from("directory_cache")
      .select("members")
      .eq("country_code", countryCode);
    if (cacheRows && cacheRows.length > 0) {
      const { data: allExisting } = await supabase
        .from("partners")
        .select("wca_id")
        .eq("country_code", countryCode)
        .not("wca_id", "is", null);
      const existingSet = new Set(
        (allExisting || []).map((p: Record<string, unknown>) => p.wca_id),
      );
      for (const row of cacheRows) {
        const members = row.members as Record<string, unknown>[];
        if (Array.isArray(members)) {
          for (const m of members) {
            const id = typeof m === "object"
              ? ((m as Record<string, unknown>).wca_id ||
                (m as Record<string, unknown>).id)
              : m;
            if (id && !existingSet.has(Number(id))) {
              wcaIds.push(Number(id));
            }
          }
        }
      }
    }
    wcaIds = [...new Set(wcaIds)].filter((id) => !deadIdSet.has(id));
  } else {
    const { data: dbPartners } = await supabase
      .from("partners")
      .select("wca_id")
      .eq("country_code", countryCode)
      .not("wca_id", "is", null);
    wcaIds = (dbPartners || [])
      .map((p: Record<string, unknown>) => p.wca_id as number)
      .filter(Boolean);
    const { data: cacheRows } = await supabase
      .from("directory_cache")
      .select("members")
      .eq("country_code", countryCode);
    if (cacheRows) {
      for (const row of cacheRows) {
        const members = row.members as Record<string, unknown>[];
        if (Array.isArray(members)) {
          for (const m of members) {
            const id = typeof m === "object"
              ? ((m as Record<string, unknown>).wca_id ||
                (m as Record<string, unknown>).id)
              : m;
            if (id) wcaIds.push(Number(id));
          }
        }
      }
    }
    wcaIds = [...new Set(wcaIds)].filter((id) => !deadIdSet.has(id));
  }

  return wcaIds;
}

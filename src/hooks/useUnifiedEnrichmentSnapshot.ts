/**
 * useUnifiedEnrichmentSnapshot — LOVABLE-77B
 *
 * Snapshot read-only dello stato di arricchimento di un partner per i 3 motori
 * (Base / Deep Local / Sherlock). Usato dall'UI per mostrare in tempo reale
 * cosa l'AI ha a disposizione PRIMA di generare l'email.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EnrichmentSnapshot {
  base: { available: boolean; age_days: number | null; fields: string[] };
  deep: { available: boolean; age_days: number | null; fields: string[] };
  sherlock: { available: boolean; age_days: number | null; level: string | null };
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

export function useUnifiedEnrichmentSnapshot(partnerId: string | null | undefined) {
  return useQuery({
    queryKey: ["enrichment-snapshot", partnerId],
    enabled: !!partnerId,
    staleTime: 30_000,
    queryFn: async (): Promise<EnrichmentSnapshot> => {
      if (!partnerId) throw new Error("partnerId required");

      const { data: partner } = await supabase
        .from("partners")
        .select("enrichment_data")
        .eq("id", partnerId)
        .maybeSingle();

      const ed = ((partner as { enrichment_data?: Record<string, unknown> } | null)?.enrichment_data ?? {}) as Record<string, unknown>;

      // ── Base ──
      const baseFields: string[] = [];
      if (typeof ed.linkedin_url === "string" && ed.linkedin_url) baseFields.push("LinkedIn");
      if (typeof ed.logo_url === "string" && ed.logo_url) baseFields.push("Logo");
      const we = ed.website_excerpt as { description?: string; emails?: string[]; phones?: string[] } | undefined;
      if (we?.description) baseFields.push("Sito");
      if (Array.isArray(we?.emails) && we.emails.length) baseFields.push(`${we.emails.length} email`);
      if (Array.isArray(we?.phones) && we.phones.length) baseFields.push(`${we.phones.length} tel`);

      // ── Deep ──
      const deepFields: string[] = [];
      const cp = ed.contact_profiles;
      const cpCount = Array.isArray(cp) ? cp.length : (cp && typeof cp === "object" ? Object.keys(cp).length : 0);
      if (cpCount) deepFields.push(`${cpCount} contatti`);
      if (typeof ed.website_quality_score === "number") deepFields.push(`Score ${ed.website_quality_score}/5`);
      if (ed.reputation) deepFields.push("Reputazione");
      if (ed.google_maps) deepFields.push("Maps");
      if (ed.contact_mentions) deepFields.push("Mentions");

      // ── Sherlock ──
      const { data: sherlock } = await supabase
        .from("sherlock_investigations")
        .select("created_at, level")
        .eq("partner_id", partnerId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const baseEnrichedAt = typeof ed.base_enriched_at === "string"
        ? ed.base_enriched_at
        : (typeof ed.website_scraped_at === "string" ? ed.website_scraped_at : null);
      const deepSearchAt = typeof ed.deep_search_at === "string" ? ed.deep_search_at : null;

      return {
        base: {
          available: baseFields.length > 0,
          age_days: daysSince(baseEnrichedAt),
          fields: baseFields,
        },
        deep: {
          available: deepFields.length > 0,
          age_days: daysSince(deepSearchAt),
          fields: deepFields,
        },
        sherlock: {
          available: !!sherlock,
          age_days: daysSince(sherlock?.created_at ?? null),
          level: (sherlock as { level?: string | number } | null)?.level != null
            ? String((sherlock as { level: string | number }).level)
            : null,
        },
      };
    },
  });
}
/**
 * useUnifiedEnrichmentSnapshot — LOVABLE-73
 * Restituisce lo stato reale di arricchimento per un partner:
 * Base (Settings → Arricchimento), Deep Search Local, Sherlock, Legacy.
 * Usato da OraclePanel per mostrare cosa è già disponibile prima di
 * eseguire una nuova Deep Search.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { asEnrichmentData, type ContactProfile } from "@/lib/types/enrichmentData";

export interface EnrichmentSnapshot {
  readonly base: { available: boolean; age_days: number | null; fields: string[] };
  readonly deep: { available: boolean; age_days: number | null; fields: string[] };
  readonly sherlock: { available: boolean; age_days: number | null; level: string | null };
  readonly legacy: { available: boolean };
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((Date.now() - t) / 86_400_000);
}

export function useUnifiedEnrichmentSnapshot(partnerId: string | null) {
  return useQuery({
    queryKey: ["enrichment-snapshot", partnerId],
    enabled: !!partnerId,
    staleTime: 60_000,
    queryFn: async (): Promise<EnrichmentSnapshot> => {
      if (!partnerId) throw new Error("No partnerId");

      const { data: partner } = await supabase
        .from("partners")
        .select("enrichment_data")
        .eq("id", partnerId)
        .maybeSingle();

      const ed = asEnrichmentData(partner?.enrichment_data);
      const websiteExcerpt = ed.website_excerpt as
        | { description?: string; emails?: string[]; phones?: string[] }
        | undefined;
      const contactProfilesRaw = ed.contact_profiles as
        | Record<string, ContactProfile>
        | ContactProfile[]
        | undefined;
      const contactCount = Array.isArray(contactProfilesRaw)
        ? contactProfilesRaw.length
        : contactProfilesRaw
          ? Object.keys(contactProfilesRaw).length
          : 0;
      const contactMentions = ed.contact_mentions as unknown[] | undefined;

      const baseFields: string[] = [];
      if (ed.linkedin_url) baseFields.push("LinkedIn");
      if (ed.logo_url) baseFields.push("Logo");
      if (websiteExcerpt?.description) baseFields.push("Sito");
      if (websiteExcerpt?.emails?.length) baseFields.push("Email");
      if (websiteExcerpt?.phones?.length) baseFields.push("Telefoni");

      const deepFields: string[] = [];
      if (contactCount > 0) deepFields.push(`${contactCount} contatti`);
      if (ed.website_quality_score) deepFields.push("Quality score");
      if (ed.reputation) deepFields.push("Reputazione");
      if (ed.google_maps) deepFields.push("Google Maps");
      if (contactMentions?.length) deepFields.push("Menzioni");

      const { data: sherlock } = await supabase
        .from("sherlock_investigations")
        .select("created_at, level")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        base: {
          available: baseFields.length > 0,
          age_days: daysSince((ed.base_enriched_at as string | undefined) ?? null),
          fields: baseFields,
        },
        deep: {
          available: deepFields.length > 0,
          age_days: daysSince((ed.deep_search_at as string | undefined) ?? null),
          fields: deepFields,
        },
        sherlock: {
          available: !!sherlock,
          age_days: daysSince(sherlock?.created_at ?? null),
          level: sherlock?.level != null ? String(sherlock.level) : null,
        },
        legacy: {
          available: !!(ed.website_summary || ed.linkedin_summary || ed.deep_search_summary),
        },
      };
    },
  });
}
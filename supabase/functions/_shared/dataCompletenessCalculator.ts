/**
 * dataCompletenessCalculator.ts — Data completeness scoring
 *
 * Calculates the percentage of available data sources for a partner.
 */

import { extractFromEnrichment } from "./qualityHelpers.ts";
import type { PartnerData } from "./qualityTypes.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/**
 * Calcola la disponibilità dei dati (percentuale di data sources disponibili).
 */
export async function calculateDataCompleteness(
  supabase: SupabaseClient,
  partnerId: string,
  partner: PartnerData,
): Promise<number> {
  const sources: boolean[] = [];

  // Data sources check
  sources.push(!!partner.raw_profile_markdown);
  sources.push(!!partner.ai_parsed_at);
  sources.push(!!partner.website);
  sources.push(!!partner.linkedin_url);
  sources.push(!!partner.logo_url);
  sources.push(!!partner.member_since);
  sources.push(!!partner.membership_expires);
  sources.push(!!partner.has_branches);

  // Enrichment data sources
  const websiteQualityScore = extractFromEnrichment<number>(
    partner.enrichment_data,
    "website_quality_score",
    null,
  );
  sources.push(websiteQualityScore !== null);

  const hasReputation = extractFromEnrichment<unknown>(partner.enrichment_data, "reputation", null) !== null;
  sources.push(hasReputation);

  const googleMapsData = extractFromEnrichment<unknown>(partner.enrichment_data, "google_maps", null);
  sources.push(googleMapsData !== null);

  const contactProfiles = extractFromEnrichment<unknown[]>(
    partner.enrichment_data,
    "contact_profiles",
    null,
  );
  sources.push(contactProfiles !== null && contactProfiles.length > 0);

  const deepSearchAt = extractFromEnrichment<string>(partner.enrichment_data, "deep_search_at", null);
  sources.push(deepSearchAt !== null);

  // DB relations
  const { count: contactCount } = await supabase
    .from("partner_contacts")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId);
  sources.push(contactCount !== null && contactCount > 0);

  const { count: networkCount } = await supabase
    .from("partner_networks")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId);
  sources.push(networkCount !== null && networkCount > 0);

  const { count: certCount } = await supabase
    .from("partner_certifications")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId);
  sources.push(certCount !== null && certCount > 0);

  const { count: serviceCount } = await supabase
    .from("partner_services")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId);
  sources.push(serviceCount !== null && serviceCount > 0);

  // Sherlock
  const { count: sherlockCount } = await supabase
    .from("sherlock_investigations")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .eq("status", "completed");
  sources.push(sherlockCount !== null && sherlockCount > 0);

  const available = sources.filter(Boolean).length;
  const percentage = Math.round((available / sources.length) * 100);
  return percentage;
}

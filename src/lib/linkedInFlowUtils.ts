import { supabase } from "@/integrations/supabase/client";

/**
 * Save enrichment data back to the partner record in the DB.
 */
export async function saveEnrichmentToPartner(companyName: string, enrichment: Record<string, any>) {
  try {
    const { data: partners } = await supabase
      .from("partners")
      .select("id, enrichment_data")
      .ilike("company_name", `%${companyName}%`)
      .limit(1);

    if (partners?.[0]) {
      const existing = (partners[0].enrichment_data as Record<string, any>) || {};
      const update: Record<string, any> = { ...existing };

      // LinkedIn data
      if (enrichment.linkedin_ok && enrichment.linkedin) {
        update.linkedin_profile_name = enrichment.linkedin.name;
        update.linkedin_profile_headline = enrichment.linkedin.headline;
        update.linkedin_profile_location = enrichment.linkedin.location;
        update.linkedin_profile_about = enrichment.linkedin.about?.slice(0, 2000);
        update.linkedin_profile_url = enrichment.linkedin.profileUrl;
        update.linkedin_scraped_at = enrichment.processed_at;
        update.linkedin_summary = [
          enrichment.linkedin.name,
          enrichment.linkedin.headline,
          enrichment.linkedin.about?.slice(0, 500),
        ].filter(Boolean).join(" — ");
      }

      // Website data (via Partner Connect)
      if (enrichment.website_ok && enrichment.website && !enrichment.website_cached) {
        update.website_title = enrichment.website.title;
        update.website_description = enrichment.website.description;
        update.website_content_preview = enrichment.website.content_preview?.slice(0, 3000);
        update.website_lang = enrichment.website.lang;
        update.website_scraped_at = enrichment.processed_at;
        update.website_scrape_source = "partner_connect";
      }

      // AI Analysis (via Partner Connect brain)
      if (enrichment.website_analysis) {
        update.website_analysis = enrichment.website_analysis;
        update.website_analyzed_at = enrichment.processed_at;
      }

      // Connection status
      if (enrichment.connection_status) {
        update.linkedin_connection_status = enrichment.connection_status;
      }
      if (enrichment.connection_sent !== undefined) {
        update.linkedin_connection_sent = enrichment.connection_sent;
        update.linkedin_connection_at = enrichment.processed_at;
      }
      if (enrichment.connection_skipped) {
        update.linkedin_connection_skipped = true;
        update.linkedin_connection_skip_reason = enrichment.connection_skip_reason;
      }

      await supabase.from("partners").update({
        enrichment_data: update,
      }).eq("id", partners[0].id);
    }
  } catch (e) {
    console.error("Failed to save enrichment to partner:", e);
  }
}

export async function getProcessedCount(jobId: string): Promise<number> {
  const { count } = await supabase
    .from("linkedin_flow_items")
    .select("*", { count: "exact", head: true })
    .eq("job_id", jobId)
    .in("status", ["completed", "error"]);
  return count || 0;
}

export async function getCountByStatus(jobId: string, status: string): Promise<number> {
  const { count } = await supabase
    .from("linkedin_flow_items")
    .select("*", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("status", status);
  return count || 0;
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

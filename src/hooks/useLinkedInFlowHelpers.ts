/**
 * LinkedIn Flow — Pure helper functions extracted from useLinkedInFlow.
 * Zero React dependencies.
 */
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";

const log = createLogger("useLinkedInFlowHelpers");

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

export async function saveEnrichmentToPartner(companyName: string, enrichment: Record<string, unknown>) {
  try {
    const { data: partners } = await supabase
      .from("partners")
      .select("id, enrichment_data")
      .ilike("company_name", `%${companyName}%`)
      .limit(1);

    if (partners?.[0]) {
      const existing = (partners[0].enrichment_data as Record<string, unknown>) || {};
      const update: Record<string, unknown> = { ...existing };

      const li = enrichment.linkedin as Record<string, string> | undefined;
      if (enrichment.linkedin_ok && li) {
        update.linkedin_profile_name = li.name;
        update.linkedin_profile_headline = li.headline;
        update.linkedin_profile_location = li.location;
        update.linkedin_profile_about = li.about?.slice(0, 2000);
        update.linkedin_profile_url = li.profileUrl;
        update.linkedin_scraped_at = enrichment.processed_at;
        update.linkedin_summary = [li.name, li.headline, li.about?.slice(0, 500)].filter(Boolean).join(" — ");
      }

      const ws = enrichment.website as Record<string, string> | undefined;
      if (enrichment.website_ok && ws && !enrichment.website_cached) {
        update.website_title = ws.title;
        update.website_description = ws.description;
        update.website_content_preview = ws.content_preview?.slice(0, 3000);
        update.website_lang = ws.lang;
        update.website_scraped_at = enrichment.processed_at;
        update.website_scrape_source = "partner_connect";
      }

      if (enrichment.website_analysis) {
        update.website_analysis = enrichment.website_analysis;
        update.website_analyzed_at = enrichment.processed_at;
      }

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
        enrichment_data: update as Record<string, string | number | boolean | null>,
      }).eq("id", partners[0].id);
    }
  } catch (e) {
    log.error("save enrichment to partner failed", { message: e instanceof Error ? e.message : String(e) });
  }
}

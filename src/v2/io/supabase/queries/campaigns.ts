/**
 * IO Queries: Campaigns — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type CampaignJob } from "../../../core/domain/entities";
import { mapCampaignJobRow } from "../../../core/mappers/campaign-mapper";

export async function fetchCampaignJobs(
  batchId: string,
): Promise<Result<CampaignJob[], AppError>> {
  try {
    const { data, error } = await supabase
      .from("campaign_jobs")
      .select("*")
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true });

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "campaign_jobs", batchId,
      }, "fetchCampaignJobs"));
    }

    if (!data) return ok([]);

    const jobs: CampaignJob[] = [];
    for (const row of data) {
      const mapped = mapCampaignJobRow(row);
      if (mapped._tag === "Err") return mapped;
      jobs.push(mapped.value);
    }
    return ok(jobs);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchCampaignJobs"));
  }
}

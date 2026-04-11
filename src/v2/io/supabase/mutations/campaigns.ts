/**
 * IO Mutations: Campaigns — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type CampaignJob } from "../../../core/domain/entities";
import { mapCampaignJobRow } from "../../../core/mappers/campaign-mapper";
import type { Database } from "@/integrations/supabase/types";

type CampaignJobInsert = Database["public"]["Tables"]["campaign_jobs"]["Insert"];
type CampaignJobUpdate = Database["public"]["Tables"]["campaign_jobs"]["Update"];

export async function createCampaignJob(
  input: CampaignJobInsert,
): Promise<Result<CampaignJob, AppError>> {
  try {
    const { data, error } = await supabase
      .from("campaign_jobs")
      .insert(input)
      .select()
      .single();

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "campaign_jobs", operation: "insert",
      }, "createCampaignJob"));
    }

    return mapCampaignJobRow(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "createCampaignJob"));
  }
}

export async function updateCampaignJob(
  jobId: string,
  updates: CampaignJobUpdate,
): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabase
      .from("campaign_jobs")
      .update(updates)
      .eq("id", jobId);

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "campaign_jobs", jobId, operation: "update",
      }, "updateCampaignJob"));
    }

    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "updateCampaignJob"));
  }
}

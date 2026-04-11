/**
 * IO Mutations: Campaigns — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type CampaignJob, type CampaignJobType } from "../../../core/domain/entities";
import { mapCampaignJobRow } from "../../../core/mappers/campaign-mapper";

export interface CreateCampaignJobInput {
  readonly batch_id: string;
  readonly partner_id: string;
  readonly company_name: string;
  readonly country_code: string;
  readonly country_name: string;
  readonly job_type?: CampaignJobType;
  readonly email?: string | null;
  readonly phone?: string | null;
}

export async function createCampaignJob(
  input: CreateCampaignJobInput,
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

export async function updateCampaignJobStatus(
  jobId: string,
  status: string,
  notes?: string,
): Promise<Result<void, AppError>> {
  try {
    const updates: Record<string, unknown> = { status };
    if (status === "completed" || status === "failed") {
      updates.completed_at = new Date().toISOString();
    }
    if (notes) updates.notes = notes;

    const { error } = await supabase
      .from("campaign_jobs")
      .update(updates)
      .eq("id", jobId);

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "campaign_jobs", jobId, operation: "update",
      }, "updateCampaignJobStatus"));
    }

    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "updateCampaignJobStatus"));
  }
}

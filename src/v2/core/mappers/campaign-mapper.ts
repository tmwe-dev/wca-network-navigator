/**
 * Campaign Mapper — DB row → Domain entity
 */
import { type Result, ok, err } from "../domain/result";
import { ioError, type AppError } from "../domain/errors";
import { CampaignJobRowSchema } from "../../io/supabase/schemas/campaign-schema";
import { type CampaignJob, campaignJobId, campaignId, partnerId, userId } from "../domain/entities";

export function mapCampaignJobRow(row: unknown): Result<CampaignJob, AppError> {
  const parsed = CampaignJobRowSchema.safeParse(row);
  if (!parsed.success) {
    return err(ioError("SCHEMA_MISMATCH", `CampaignJob row validation failed: ${parsed.error.message}`, {
      issues: parsed.error.issues,
    }, "campaign-mapper"));
  }

  const r = parsed.data;
  return ok({
    id: campaignJobId(r.id),
    batchId: campaignId(r.batch_id),
    partnerId: partnerId(r.partner_id),
    companyName: r.company_name,
    countryCode: r.country_code,
    countryName: r.country_name,
    jobType: r.job_type,
    status: r.status,
    email: r.email,
    phone: r.phone,
    city: r.city,
    notes: r.notes,
    assignedTo: r.assigned_to,
    completedAt: r.completed_at,
    userId: r.user_id ? userId(r.user_id) : null,
    createdAt: r.created_at,
  });
}

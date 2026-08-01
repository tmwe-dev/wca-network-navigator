/**
 * Zod Schema: Campaign Jobs
 */
import { z } from "zod";

const CampaignJobTypeSchema = z.enum(["email", "call"]);
const CampaignJobStatusSchema = z.enum(["pending", "in_progress", "completed", "skipped"]);

export const CampaignJobRowSchema = z.object({
  id: z.string().uuid(),
  batch_id: z.string().uuid(),
  partner_id: z.string().uuid(),
  company_name: z.string(),
  country_code: z.string(),
  country_name: z.string(),
  job_type: CampaignJobTypeSchema,
  status: CampaignJobStatusSchema,
  email: z.string().nullable(),
  phone: z.string().nullable(),
  city: z.string().nullable(),
  notes: z.string().nullable(),
  assigned_to: z.string().uuid().nullable(),
  completed_at: z.string().nullable(),
  user_id: z.string().uuid().nullable(),
  created_at: z.string(),
});

export type CampaignJobRow = z.infer<typeof CampaignJobRowSchema>;

export const CampaignJobListResponseSchema = z.array(CampaignJobRowSchema);

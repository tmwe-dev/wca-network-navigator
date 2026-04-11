/**
 * Zod Schema: Download Jobs
 */
import { z } from "zod";

export const DownloadJobRowSchema = z.object({
  id: z.string().uuid(),
  country_code: z.string(),
  country_name: z.string(),
  network_name: z.string(),
  job_type: z.string(),
  status: z.string(),
  total_count: z.number(),
  current_index: z.number(),
  contacts_found_count: z.number(),
  contacts_missing_count: z.number(),
  delay_seconds: z.number(),
  error_message: z.string().nullable(),
  user_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
});

export type DownloadJobRow = z.infer<typeof DownloadJobRowSchema>;

/**
 * Zod Schema: Email Campaign Queue (Outreach)
 */
import { z } from "zod";

export const OutreachQueueRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  partner_id: z.string().uuid(),
  recipient_email: z.string(),
  recipient_name: z.string().nullable(),
  subject: z.string(),
  html_body: z.string(),
  status: z.string(),
  position: z.number(),
  scheduled_at: z.string().nullable(),
  sent_at: z.string().nullable(),
  error_message: z.string().nullable(),
  retry_count: z.number(),
  created_at: z.string(),
});

export type OutreachQueueRow = z.infer<typeof OutreachQueueRowSchema>;

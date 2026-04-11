/**
 * Zod Schema: Activities
 */
import { z } from "zod";

const ActivityTypeSchema = z.enum([
  "call", "email", "meeting", "note", "task",
  "follow_up", "linkedin", "whatsapp", "ai_generated",
]);

const ActivityStatusSchema = z.enum([
  "pending", "in_progress", "completed", "cancelled",
]);

export const ActivityRowSchema = z.object({
  id: z.string().uuid(),
  partner_id: z.string().uuid().nullable(),
  assigned_to: z.string().uuid().nullable(),
  activity_type: ActivityTypeSchema,
  title: z.string(),
  description: z.string().nullable(),
  status: ActivityStatusSchema,
  priority: z.string(),
  due_date: z.string().nullable(),
  completed_at: z.string().nullable(),
  scheduled_at: z.string().nullable(),
  source_type: z.string(),
  source_id: z.string().uuid(),
  source_meta: z.record(z.string(), z.unknown()).nullable(),
  email_subject: z.string().nullable(),
  email_body: z.string().nullable(),
  reviewed: z.boolean(),
  sent_at: z.string().nullable(),
  campaign_batch_id: z.string().nullable(),
  selected_contact_id: z.string().uuid().nullable(),
  user_id: z.string().uuid().nullable(),
  executed_by_agent_id: z.string().uuid().nullable(),
  created_at: z.string(),
});

export type ActivityRow = z.infer<typeof ActivityRowSchema>;

export const ActivityListResponseSchema = z.array(ActivityRowSchema);

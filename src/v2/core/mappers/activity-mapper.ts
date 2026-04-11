/**
 * Activity Mapper — DB row → Domain entity
 */
import { type Result, ok, err } from "../domain/result";
import { ioError, type AppError } from "../domain/errors";
import { ActivityRowSchema } from "../../io/supabase/schemas/activity-schema";
import { type Activity, activityId, partnerId, agentId, userId } from "../domain/entities";

export function mapActivityRow(row: unknown): Result<Activity, AppError> {
  const parsed = ActivityRowSchema.safeParse(row);
  if (!parsed.success) {
    return err(ioError("SCHEMA_MISMATCH", `Activity row validation failed: ${parsed.error.message}`, {
      issues: parsed.error.issues,
    }, "activity-mapper"));
  }

  const r = parsed.data;
  return ok({
    id: activityId(r.id),
    partnerId: r.partner_id ? partnerId(r.partner_id) : null,
    assignedTo: r.assigned_to,
    activityType: r.activity_type,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    dueDate: r.due_date,
    completedAt: r.completed_at,
    scheduledAt: r.scheduled_at,
    sourceType: r.source_type,
    sourceId: r.source_id,
    sourceMeta: r.source_meta,
    emailSubject: r.email_subject,
    emailBody: r.email_body,
    reviewed: r.reviewed,
    sentAt: r.sent_at,
    userId: r.user_id ? userId(r.user_id) : null,
    executedByAgentId: r.executed_by_agent_id ? agentId(r.executed_by_agent_id) : null,
    createdAt: r.created_at,
  });
}

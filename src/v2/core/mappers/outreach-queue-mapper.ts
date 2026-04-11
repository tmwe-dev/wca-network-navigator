/**
 * OutreachQueue Mapper — DB row → Domain entity
 */
import { type Result, ok, err } from "../domain/result";
import { ioError, type AppError } from "../domain/errors";
import { OutreachQueueRowSchema } from "../../io/supabase/schemas/outreach-queue-schema";
import { type OutreachQueueItem, outreachQueueId, userId } from "../domain/entities";

export function mapOutreachQueueRow(row: unknown): Result<OutreachQueueItem, AppError> {
  const parsed = OutreachQueueRowSchema.safeParse(row);
  if (!parsed.success) {
    return err(ioError("SCHEMA_MISMATCH", `OutreachQueue row validation failed: ${parsed.error.message}`, {
      issues: parsed.error.issues,
    }, "outreach-queue-mapper"));
  }
  const r = parsed.data;
  return ok({
    id: outreachQueueId(r.id),
    userId: r.user_id ? userId(r.user_id) : null,
    partnerId: r.partner_id,
    recipientEmail: r.recipient_email,
    recipientName: r.recipient_name,
    subject: r.subject,
    htmlBody: r.html_body,
    status: r.status,
    position: r.position,
    scheduledAt: r.scheduled_at,
    sentAt: r.sent_at,
    errorMessage: r.error_message,
    retryCount: r.retry_count,
    createdAt: r.created_at,
  });
}

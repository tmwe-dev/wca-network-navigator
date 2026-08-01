/**
 * ChannelMessage Mapper — DB row → Domain entity
 */
import { type Result, ok, err } from "../domain/result";
import { ioError, type AppError } from "../domain/errors";
import { ChannelMessageRowSchema } from "../../io/supabase/schemas/channel-message-schema";
import { type ChannelMessage, messageId, userId, partnerId } from "../domain/entities";

export function mapChannelMessageRow(row: unknown): Result<ChannelMessage, AppError> {
  const parsed = ChannelMessageRowSchema.safeParse(row);
  if (!parsed.success) {
    return err(ioError("SCHEMA_MISMATCH", `ChannelMessage row validation failed: ${parsed.error.message}`, {
      issues: parsed.error.issues,
    }, "channel-message-mapper"));
  }
  const r = parsed.data;
  return ok({
    id: messageId(r.id),
    userId: userId(r.user_id),
    channel: r.channel,
    direction: r.direction,
    subject: r.subject,
    fromAddress: r.from_address,
    toAddress: r.to_address,
    bodyText: r.body_text,
    bodyHtml: r.body_html,
    partnerId: r.partner_id ? partnerId(r.partner_id) : null,
    category: r.category,
    readAt: r.read_at,
    emailDate: r.email_date,
    createdAt: r.created_at,
  });
}

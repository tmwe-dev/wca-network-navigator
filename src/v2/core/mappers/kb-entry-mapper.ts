/**
 * KbEntry Mapper — DB row → Domain entity
 */
import { type Result, ok, err } from "../domain/result";
import { ioError, type AppError } from "../domain/errors";
import { KbEntryRowSchema } from "../../io/supabase/schemas/kb-entry-schema";
import { type KbEntry, kbEntryId, userId } from "../domain/entities";

export function mapKbEntryRow(row: unknown): Result<KbEntry, AppError> {
  const parsed = KbEntryRowSchema.safeParse(row);
  if (!parsed.success) {
    return err(ioError("SCHEMA_MISMATCH", `KbEntry row validation failed: ${parsed.error.message}`, {
      issues: parsed.error.issues,
    }, "kb-entry-mapper"));
  }
  const r = parsed.data;
  return ok({
    id: kbEntryId(r.id),
    title: r.title,
    content: r.content,
    tags: r.tags ?? [],
    userId: userId(r.user_id),
    createdAt: r.created_at,
  });
}

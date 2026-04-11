/**
 * CreditTransaction Mapper — DB row → Domain entity
 */
import { type Result, ok, err } from "../domain/result";
import { ioError, type AppError } from "../domain/errors";
import { CreditTransactionRowSchema } from "../../io/supabase/schemas/credit-transaction-schema";
import { type CreditTransaction, creditTransactionId, userId } from "../domain/entities";

export function mapCreditTransactionRow(row: unknown): Result<CreditTransaction, AppError> {
  const parsed = CreditTransactionRowSchema.safeParse(row);
  if (!parsed.success) {
    return err(ioError("SCHEMA_MISMATCH", `CreditTransaction row validation failed: ${parsed.error.message}`, {
      issues: parsed.error.issues,
    }, "credit-transaction-mapper"));
  }
  const r = parsed.data;
  return ok({
    id: creditTransactionId(r.id),
    userId: userId(r.user_id),
    amount: r.amount,
    operation: r.operation,
    description: r.description,
    createdAt: r.created_at,
  });
}

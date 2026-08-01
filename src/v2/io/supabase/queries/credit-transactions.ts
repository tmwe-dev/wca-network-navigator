/**
 * IO Queries: Credit Transactions — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type CreditTransaction } from "../../../core/domain/entities";
import { mapCreditTransactionRow } from "../../../core/mappers/credit-transaction-mapper";

export async function fetchCreditTransactions(): Promise<Result<CreditTransaction[], AppError>> {
  try {
    const { data, error } = await supabase
      .from("credit_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "credit_transactions" }, "fetchCreditTransactions"));
    if (!data) return ok([]);
    const txns: CreditTransaction[] = [];
    for (const row of data) {
      const mapped = mapCreditTransactionRow(row);
      if (mapped._tag === "Err") return mapped;
      txns.push(mapped.value);
    }
    return ok(txns);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchCreditTransactions"));
  }
}

export async function fetchCreditBalance(userIdVal: string): Promise<Result<number, AppError>> {
  try {
    const { data, error } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", userIdVal)
      .single();
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "user_credits" }, "fetchCreditBalance"));
    return ok(data?.balance ?? 0);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchCreditBalance"));
  }
}

/**
 * IO Queries: Operators — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type Operator } from "../../../core/domain/entities";
import { OperatorRowSchema } from "../schemas/operator-schema";
import { operatorId, userId } from "../../../core/domain/entities";

export async function fetchOperators(): Promise<Result<Operator[], AppError>> {
  try {
    const { data, error } = await supabase
      .from("operators")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "operators" }, "fetchOperators"));
    if (!data) return ok([]);
    const ops: Operator[] = [];
    for (const row of data) {
      const parsed = OperatorRowSchema.safeParse(row);
      if (!parsed.success) return err(ioError("SCHEMA_MISMATCH", parsed.error.message, {}, "fetchOperators"));
      const r = parsed.data;
      ops.push({
        id: operatorId(r.id),
        userId: r.user_id ? userId(r.user_id) : userId(""),
        name: r.name,
        email: r.email,
        isAdmin: r.is_admin,
        isActive: r.is_active,
        createdAt: r.created_at,
      });
    }
    return ok(ops);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchOperators"));
  }
}

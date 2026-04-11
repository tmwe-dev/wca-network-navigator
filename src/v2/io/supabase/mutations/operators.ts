/**
 * IO Mutations: Operators — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";

export async function toggleOperatorAdmin(
  operatorId: string,
  isAdmin: boolean,
): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabase
      .from("operators")
      .update({ is_admin: isAdmin })
      .eq("id", operatorId);
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "operators", operatorId }, "toggleOperatorAdmin"));
    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "toggleOperatorAdmin"));
  }
}

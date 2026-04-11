/**
 * IO Mutations: Prospects — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import type { Database } from "@/integrations/supabase/types";

type ProspectUpdate = Database["public"]["Tables"]["prospects"]["Update"];

export async function updateProspectStatus(
  prospectId: string,
  updates: ProspectUpdate,
): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabase.from("prospects").update(updates).eq("id", prospectId);
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "prospects", prospectId }, "updateProspectStatus"));
    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "updateProspectStatus"));
  }
}

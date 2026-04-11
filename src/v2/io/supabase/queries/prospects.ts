/**
 * IO Queries: Prospects (RA) — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type Prospect } from "../../../core/domain/entities";
import { mapProspectRow } from "../../../core/mappers/prospect-mapper";

export async function fetchProspects(): Promise<Result<Prospect[], AppError>> {
  try {
    const { data, error } = await supabase
      .from("prospects")
      .select("*")
      .order("company_name");
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "prospects" }, "fetchProspects"));
    if (!data) return ok([]);
    const list: Prospect[] = [];
    for (const row of data) {
      const mapped = mapProspectRow(row);
      if (mapped._tag === "Err") return mapped;
      list.push(mapped.value);
    }
    return ok(list);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchProspects"));
  }
}

export async function fetchProspectsByRegion(region: string): Promise<Result<Prospect[], AppError>> {
  try {
    const { data, error } = await supabase
      .from("prospects")
      .select("*")
      .eq("region", region)
      .order("company_name");
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "prospects", region }, "fetchProspectsByRegion"));
    if (!data) return ok([]);
    const list: Prospect[] = [];
    for (const row of data) {
      const mapped = mapProspectRow(row);
      if (mapped._tag === "Err") return mapped;
      list.push(mapped.value);
    }
    return ok(list);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchProspectsByRegion"));
  }
}

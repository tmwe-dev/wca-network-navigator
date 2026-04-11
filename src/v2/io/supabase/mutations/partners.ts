/**
 * IO Mutations: Partners — Result-based CRUD
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import type { PartnerV2 } from "../../../core/domain/partner-entity";
import { mapPartnerRow } from "../../../core/mappers/partner-mapper";
import type { Database } from "@/integrations/supabase/types";

type PartnerInsert = Database["public"]["Tables"]["partners"]["Insert"];
type PartnerUpdate = Database["public"]["Tables"]["partners"]["Update"];

export async function createPartner(
  input: PartnerInsert,
): Promise<Result<PartnerV2, AppError>> {
  try {
    const { data, error } = await supabase
      .from("partners")
      .insert(input)
      .select()
      .single();

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "partners", operation: "insert",
      }, "createPartner"));
    }

    return mapPartnerRow(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "createPartner"));
  }
}

export async function updatePartner(
  partnerId: string,
  updates: PartnerUpdate,
): Promise<Result<PartnerV2, AppError>> {
  try {
    const { data, error } = await supabase
      .from("partners")
      .update(updates)
      .eq("id", partnerId)
      .select()
      .single();

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "partners", partnerId, operation: "update",
      }, "updatePartner"));
    }

    return mapPartnerRow(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "updatePartner"));
  }
}

export async function deletePartner(
  partnerId: string,
): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabase
      .from("partners")
      .delete()
      .eq("id", partnerId);

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "partners", partnerId, operation: "delete",
      }, "deletePartner"));
    }

    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "deletePartner"));
  }
}

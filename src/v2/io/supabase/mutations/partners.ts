/**
 * IO Mutations: Partners — Result-based CRUD
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type Partner } from "../../../core/domain/entities";
import { mapPartnerRow } from "../../../core/mappers/partner-mapper";

export interface CreatePartnerInput {
  readonly company_name: string;
  readonly country_code: string;
  readonly country_name: string;
  readonly network_name: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly city?: string | null;
  readonly website?: string | null;
  readonly wca_id?: number | null;
}

export async function createPartner(
  input: CreatePartnerInput,
): Promise<Result<Partner, AppError>> {
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
  updates: Partial<CreatePartnerInput>,
): Promise<Result<Partner, AppError>> {
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

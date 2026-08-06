/**
 * IO Mutations: Partners — facciata Result-based sul DAL canonico `src/data/partners`.
 * Il DAL instrada `lead_status` sul percorso guardato e gestisce le relazioni in delete.
 */
import {
  createPartner as dalCreatePartner,
  updatePartner as dalUpdatePartner,
  deletePartnersByIds,
  getPartner,
} from "@/data/partners";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import type { PartnerV2 } from "../../../core/domain/partner-entity";
import { mapPartnerRow } from "../../../core/mappers/partner-mapper";
import type { Database } from "@/integrations/supabase/types";

type PartnerInsert = Database["public"]["Tables"]["partners"]["Insert"];
type PartnerUpdate = Database["public"]["Tables"]["partners"]["Update"];

export async function createPartner(input: PartnerInsert): Promise<Result<PartnerV2, AppError>> {
  try {
    const row = await dalCreatePartner(input);
    return mapPartnerRow(row);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "createPartner"));
  }
}

export async function updatePartner(partnerId: string, updates: PartnerUpdate): Promise<Result<PartnerV2, AppError>> {
  try {
    await dalUpdatePartner(partnerId, updates);
    const row = await getPartner(partnerId);
    if (!row) {
      return err(
        ioError(
          "NOT_FOUND",
          `Partner ${partnerId} non trovato`,
          {
            table: "partners",
            partnerId,
            operation: "update",
          },
          "updatePartner",
        ),
      );
    }
    return mapPartnerRow(row);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "updatePartner"));
  }
}

export async function deletePartner(partnerId: string): Promise<Result<void, AppError>> {
  try {
    await deletePartnersByIds([partnerId]);
    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "deletePartner"));
  }
}

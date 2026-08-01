/**
 * IO Mutations: Business Cards — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type BusinessCard } from "../../../core/domain/entities";
import { mapBusinessCardRow } from "../../../core/mappers/business-card-mapper";
import type { Database } from "@/integrations/supabase/types";

type BusinessCardInsert = Database["public"]["Tables"]["business_cards"]["Insert"];
type BusinessCardUpdate = Database["public"]["Tables"]["business_cards"]["Update"];

export async function createBusinessCard(
  input: BusinessCardInsert,
): Promise<Result<BusinessCard, AppError>> {
  try {
    const { data, error } = await supabase.from("business_cards").insert(input).select().single();
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "business_cards" }, "createBusinessCard"));
    return mapBusinessCardRow(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "createBusinessCard"));
  }
}

export async function updateBusinessCardMatch(
  cardId: string,
  updates: BusinessCardUpdate,
): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabase.from("business_cards").update(updates).eq("id", cardId);
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "business_cards", cardId }, "updateBusinessCardMatch"));
    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "updateBusinessCardMatch"));
  }
}

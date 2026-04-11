/**
 * IO Queries: Business Cards — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type BusinessCard } from "../../../core/domain/entities";
import { mapBusinessCardRow } from "../../../core/mappers/business-card-mapper";

export async function fetchBusinessCards(): Promise<Result<BusinessCard[], AppError>> {
  try {
    const { data, error } = await supabase
      .from("business_cards")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "business_cards" }, "fetchBusinessCards"));
    if (!data) return ok([]);
    const cards: BusinessCard[] = [];
    for (const row of data) {
      const mapped = mapBusinessCardRow(row);
      if (mapped._tag === "Err") return mapped;
      cards.push(mapped.value);
    }
    return ok(cards);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchBusinessCards"));
  }
}

export async function fetchBusinessCardsByPartner(partnerId: string): Promise<Result<BusinessCard[], AppError>> {
  try {
    const { data, error } = await supabase
      .from("business_cards")
      .select("*")
      .eq("matched_partner_id", partnerId)
      .order("created_at", { ascending: false });
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "business_cards", partnerId }, "fetchBusinessCardsByPartner"));
    if (!data) return ok([]);
    const cards: BusinessCard[] = [];
    for (const row of data) {
      const mapped = mapBusinessCardRow(row);
      if (mapped._tag === "Err") return mapped;
      cards.push(mapped.value);
    }
    return ok(cards);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchBusinessCardsByPartner"));
  }
}

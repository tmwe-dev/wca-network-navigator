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
    const { data, error } = await supabase.from("business_cards").select("*").order("created_at", { ascending: false });
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
    if (error)
      return err(
        ioError("DATABASE_ERROR", error.message, { table: "business_cards", partnerId }, "fetchBusinessCardsByPartner"),
      );
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

/* ── Raw exact count (Explore tab counters) ────────────── */
export async function fetchBusinessCardsCountRaw(): Promise<{
  count: number | null;
  error: { message: string } | null;
}> {
  return supabase.from("business_cards").select("*", { count: "exact", head: true });
}

export interface BusinessCardListRow {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  match_status: string | null;
  match_confidence: number | null;
  lead_status: string | null;
  event_name: string | null;
  created_at: string;
}

/** Elenco business card dell'utente per la vista Network V2 (raw, no mapping). */
export async function fetchBusinessCardsForUser(
  userId: string,
): Promise<{ data: BusinessCardListRow[]; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("business_cards")
    .select(
      "id, company_name, contact_name, email, phone, match_status, match_confidence, lead_status, event_name, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  return { data: (data ?? []) as unknown as BusinessCardListRow[], error };
}

/**
 * IO Queries: Partner Facets — Unique countries for filters
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";

export interface PartnerFacets {
  readonly countries: readonly string[];
  readonly totalCount: number;
}

export async function fetchPartnerFacets(): Promise<Result<PartnerFacets, AppError>> {
  try {
    const [countriesRes, countRes] = await Promise.all([
      supabase.from("partners").select("country_code").order("country_code"),
      supabase.from("partners").select("id", { count: "exact", head: true }),
    ]);

    if (countriesRes.error) {
      return err(ioError("DATABASE_ERROR", countriesRes.error.message, {}, "fetchPartnerFacets"));
    }

    const uniqueCountries = [...new Set(
      (countriesRes.data ?? []).map((r) => r.country_code).filter(Boolean)
    )].sort();

    return ok({
      countries: uniqueCountries,
      totalCount: countRes.count ?? 0,
    });
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchPartnerFacets"));
  }
}

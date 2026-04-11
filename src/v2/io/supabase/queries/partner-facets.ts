/**
 * IO Queries: Partner Facets — countries, cities, types for filters
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";

export interface PartnerFacets {
  readonly countries: readonly string[];
  readonly cities: readonly string[];
  readonly partnerTypes: readonly string[];
  readonly totalCount: number;
}

export async function fetchPartnerFacets(): Promise<Result<PartnerFacets, AppError>> {
  try {
    const [countriesRes, citiesRes, typesRes, countRes] = await Promise.all([
      supabase.from("partners").select("country_code").eq("is_active", true).order("country_code"),
      supabase.from("partners").select("city").eq("is_active", true).order("city"),
      supabase.from("partners").select("partner_type").eq("is_active", true),
      supabase.from("partners").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);

    if (countriesRes.error) {
      return err(ioError("DATABASE_ERROR", countriesRes.error.message, {}, "fetchPartnerFacets"));
    }

    const uniqueCountries = [...new Set(
      (countriesRes.data ?? []).map((r) => r.country_code).filter(Boolean)
    )].sort();

    const uniqueCities = [...new Set(
      (citiesRes.data ?? []).map((r) => r.city).filter((c): c is string => Boolean(c))
    )].sort();

    const uniqueTypes = [...new Set(
      (typesRes.data ?? []).map((r) => r.partner_type).filter((t): t is string => Boolean(t))
    )].sort();

    return ok({
      countries: uniqueCountries,
      cities: uniqueCities,
      partnerTypes: uniqueTypes,
      totalCount: countRes.count ?? 0,
    });
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchPartnerFacets"));
  }
}

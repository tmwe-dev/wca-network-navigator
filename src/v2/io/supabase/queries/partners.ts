/**
 * IO Queries: Partners — Result-based, no throw
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import type { PartnerV2 } from "../../../core/domain/partner-entity";
import { mapPartnerRow, mapPartnerRows } from "../../../core/mappers/partner-mapper";

export interface PartnerFilters {
  readonly countryCode?: string;
  readonly networkName?: string;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export async function fetchPartners(
  filters?: PartnerFilters,
): Promise<Result<PartnerV2[], AppError>> {
  try {
    let query = supabase.from("partners").select("*");

    if (filters?.countryCode) {
      query = query.eq("country_code", filters.countryCode);
    }
    if (filters?.search) {
      query = query.ilike("company_name", `%${filters.search}%`);
    }

    const limit = filters?.limit ?? 100;
    const offset = filters?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "partners", code: error.code,
      }, "fetchPartners"));
    }

    if (!data) return ok([]);
    return mapPartnerRows(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchPartners"));
  }
}

export async function fetchPartnerById(
  partnerId: string,
): Promise<Result<PartnerV2, AppError>> {
  try {
    const { data, error } = await supabase
      .from("partners")
      .select("*")
      .eq("id", partnerId)
      .maybeSingle();

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "partners", partnerId,
      }, "fetchPartnerById"));
    }

    if (!data) {
      return err(ioError("NOT_FOUND", `Partner ${partnerId} not found`, {
        partnerId,
      }, "fetchPartnerById"));
    }

    return mapPartnerRow(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchPartnerById"));
  }
}

export async function fetchPartnersByCountry(
  countryCode: string,
): Promise<Result<PartnerV2[], AppError>> {
  return fetchPartners({ countryCode });
}

/**
 * IO Queries: Partners — Result-based, server-side pagination + advanced filters
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import type { PartnerV2 } from "../../../core/domain/partner-entity";
import { mapPartnerRow, mapPartnerRows } from "../../../core/mappers/partner-mapper";

export interface PartnerQueryFilters {
  readonly countryCode?: string;
  readonly search?: string;
  readonly partnerType?: string;
  readonly city?: string;
  readonly favorites?: boolean;
  readonly quality?: "with_email" | "with_phone" | "with_profile" | "no_email";
  readonly sort?: "name" | "rating" | "recent";
  readonly limit?: number;
  readonly offset?: number;
}

export interface PaginatedPartners {
  readonly partners: readonly PartnerV2[];
  readonly total: number;
  readonly hasMore: boolean;
}

const LIGHTWEIGHT_SELECT = `id, company_name, company_alias, country_code, country_name, city, email, phone, mobile,
  office_type, is_active, is_favorite, rating, member_since, wca_id, address, website,
  enrichment_data, partner_type, lead_status, profile_description, logo_url,
  interaction_count, last_interaction_at, created_at, updated_at, user_id, fax,
  emergency_phone, membership_expires, has_branches, branch_cities,
  rating_details, enriched_at, raw_profile_html, raw_profile_markdown,
  ai_parsed_at, converted_at`;

const PAGE_SIZE = 50;

export async function fetchPartnersPaginated(
  filters?: PartnerQueryFilters,
): Promise<Result<PaginatedPartners, AppError>> {
  try {
    const limit = filters?.limit ?? PAGE_SIZE;
    const offset = filters?.offset ?? 0;

    let query = supabase
      .from("partners")
      .select(LIGHTWEIGHT_SELECT, { count: "exact" })
      .eq("is_active", true);

    // ── Text search ──
    if (filters?.search) {
      query = query.ilike("company_name", `%${filters.search}%`);
    }

    // ── Country ──
    if (filters?.countryCode) {
      query = query.eq("country_code", filters.countryCode);
    }

    // ── City ──
    if (filters?.city) {
      query = query.ilike("city", `%${filters.city}%`);
    }

    // ── Partner type ──
    if (filters?.partnerType) {
      query = query.eq("partner_type", filters.partnerType);
    }

    // ── Favorites ──
    if (filters?.favorites) {
      query = query.eq("is_favorite", true);
    }

    // ── Quality filters ──
    if (filters?.quality === "with_email") {
      query = query.not("email", "is", null);
    } else if (filters?.quality === "with_phone") {
      query = query.or("phone.not.is.null,mobile.not.is.null");
    } else if (filters?.quality === "with_profile") {
      query = query.not("raw_profile_html", "is", null);
    } else if (filters?.quality === "no_email") {
      query = query.is("email", null);
    }

    // ── Sorting ──
    if (filters?.sort === "rating") {
      query = query.order("rating", { ascending: false, nullsFirst: false }).order("company_name");
    } else if (filters?.sort === "recent") {
      query = query.order("member_since", { ascending: false, nullsFirst: false }).order("company_name");
    } else {
      query = query.order("company_name");
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "partners", code: error.code,
      }, "fetchPartnersPaginated"));
    }

    if (!data) return ok({ partners: [], total: 0, hasMore: false });

    const mapped = mapPartnerRows(data);
    if (mapped._tag === "Err") return mapped;

    return ok({
      partners: mapped.value,
      total: count ?? 0,
      hasMore: data.length === limit,
    });
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchPartnersPaginated"));
  }
}

/** Legacy simple fetch — delegates to paginated */
export async function fetchPartners(
  filters?: PartnerQueryFilters,
): Promise<Result<PartnerV2[], AppError>> {
  const result = await fetchPartnersPaginated(filters);
  if (result._tag === "Err") return result;
  return ok([...result.value.partners]);
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

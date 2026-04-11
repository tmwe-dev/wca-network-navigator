/**
 * Partner Mapper — DB row → Domain entity (matches actual schema)
 */
import { type Result, ok, err } from "../domain/result";
import { ioError, type AppError } from "../domain/errors";
import { PartnerRowSchema } from "../../io/supabase/schemas/partner-schema";
import { partnerId, userId } from "../domain/entities";
import type { PartnerV2 } from "../domain/partner-entity";

export function mapPartnerRow(row: unknown): Result<PartnerV2, AppError> {
  const parsed = PartnerRowSchema.safeParse(row);
  if (!parsed.success) {
    return err(ioError("SCHEMA_MISMATCH", `Partner row validation failed: ${parsed.error.message}`, {
      issues: parsed.error.issues,
    }, "partner-mapper"));
  }

  const r = parsed.data;
  return ok({
    id: partnerId(r.id),
    companyName: r.company_name,
    wcaId: r.wca_id,
    countryCode: r.country_code,
    countryName: r.country_name,
    city: r.city,
    address: r.address,
    phone: r.phone,
    mobile: r.mobile,
    email: r.email,
    website: r.website,
    memberSince: r.member_since,
    officeType: r.office_type,
    partnerType: r.partner_type,
    isActive: r.is_active ?? true,
    isFavorite: r.is_favorite ?? false,
    leadStatus: r.lead_status,
    logoUrl: r.logo_url,
    rating: r.rating,
    enrichmentData: r.enrichment_data as Readonly<Record<string, unknown>> | null,
    companyAlias: r.company_alias,
    interactionCount: r.interaction_count,
    lastInteractionAt: r.last_interaction_at,
    profileDescription: r.profile_description,
    createdAt: r.created_at ?? new Date().toISOString(),
    updatedAt: r.updated_at ?? new Date().toISOString(),
    userId: r.user_id ? userId(r.user_id) : null,
  });
}

export function mapPartnerRows(rows: unknown[]): Result<PartnerV2[], AppError> {
  const partners: PartnerV2[] = [];
  for (const row of rows) {
    const mapped = mapPartnerRow(row);
    if (mapped._tag === "Err") return mapped;
    partners.push(mapped.value);
  }
  return ok(partners);
}

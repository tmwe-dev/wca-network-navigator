/**
 * Partner Mapper — DB row → Domain entity
 */
import { type Result, ok, err } from "../domain/result";
import { ioError, type AppError } from "../domain/errors";
import { PartnerRowSchema } from "../../io/supabase/schemas/partner-schema";
import { type Partner, partnerId, userId } from "../domain/entities";

export function mapPartnerRow(row: unknown): Result<Partner, AppError> {
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
    email: r.email,
    website: r.website,
    networkName: r.network_name,
    memberSince: r.member_since,
    isBlacklisted: r.is_blacklisted,
    enrichmentData: r.enrichment_data,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    userId: r.user_id ? userId(r.user_id) : null,
  });
}

export function mapPartnerRows(rows: unknown[]): Result<Partner[], AppError> {
  const partners: Partner[] = [];
  for (const row of rows) {
    const mapped = mapPartnerRow(row);
    if (mapped._tag === "Err") return mapped;
    partners.push(mapped.value);
  }
  return ok(partners);
}

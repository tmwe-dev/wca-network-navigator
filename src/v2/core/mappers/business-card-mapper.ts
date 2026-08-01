/**
 * BusinessCard Mapper — DB row → Domain entity
 */
import { type Result, ok, err } from "../domain/result";
import { ioError, type AppError } from "../domain/errors";
import { BusinessCardRowSchema } from "../../io/supabase/schemas/business-card-schema";
import { type BusinessCard, businessCardId, userId, partnerId, contactId } from "../domain/entities";

export function mapBusinessCardRow(row: unknown): Result<BusinessCard, AppError> {
  const parsed = BusinessCardRowSchema.safeParse(row);
  if (!parsed.success) {
    return err(ioError("SCHEMA_MISMATCH", `BusinessCard row validation failed: ${parsed.error.message}`, {
      issues: parsed.error.issues,
    }, "business-card-mapper"));
  }
  const r = parsed.data;
  return ok({
    id: businessCardId(r.id),
    userId: userId(r.user_id),
    companyName: r.company_name,
    contactName: r.contact_name,
    email: r.email,
    phone: r.phone,
    mobile: r.mobile,
    position: r.position,
    location: r.location,
    eventName: r.event_name,
    metAt: r.met_at,
    photoUrl: r.photo_url,
    notes: r.notes,
    tags: r.tags ?? [],
    leadStatus: r.lead_status,
    matchStatus: r.match_status,
    matchConfidence: r.match_confidence,
    matchedPartnerId: r.matched_partner_id ? partnerId(r.matched_partner_id) : null,
    matchedContactId: r.matched_contact_id ? contactId(r.matched_contact_id) : null,
    createdAt: r.created_at,
  });
}

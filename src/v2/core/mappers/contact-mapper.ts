/**
 * Contact Mapper — DB row → Domain entity
 */
import { type Result, ok, err } from "../domain/result";
import { ioError, type AppError } from "../domain/errors";
import { ContactRowSchema } from "../../io/supabase/schemas/contact-schema";
import { type Contact, contactId, importLogId, partnerId, userId } from "../domain/entities";

export function mapContactRow(row: unknown): Result<Contact, AppError> {
  const parsed = ContactRowSchema.safeParse(row);
  if (!parsed.success) {
    return err(ioError("SCHEMA_MISMATCH", `Contact row validation failed: ${parsed.error.message}`, {
      issues: parsed.error.issues,
    }, "contact-mapper"));
  }

  const r = parsed.data;
  return ok({
    id: contactId(r.id),
    importLogId: importLogId(r.import_log_id),
    name: r.name,
    companyName: r.company_name,
    email: r.email,
    phone: r.phone,
    mobile: r.mobile,
    position: r.position,
    city: r.city,
    country: r.country,
    origin: r.origin,
    leadStatus: r.lead_status,
    isSelected: r.is_selected,
    isTransferred: r.is_transferred,
    wcaPartnerId: r.wca_partner_id ? partnerId(r.wca_partner_id) : null,
    wcaMatchConfidence: r.wca_match_confidence,
    rowNumber: r.row_number,
    interactionCount: r.interaction_count,
    lastInteractionAt: r.last_interaction_at,
    createdAt: r.created_at,
    userId: r.user_id ? userId(r.user_id) : null,
  });
}

export function mapContactRows(rows: unknown[]): Result<Contact[], AppError> {
  const contacts: Contact[] = [];
  for (const row of rows) {
    const mapped = mapContactRow(row);
    if (mapped._tag === "Err") return mapped;
    contacts.push(mapped.value);
  }
  return ok(contacts);
}

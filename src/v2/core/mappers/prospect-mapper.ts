/**
 * Prospect Mapper — DB row → Domain entity
 */
import { type Result, ok, err } from "../domain/result";
import { ioError, type AppError } from "../domain/errors";
import { ProspectRowSchema } from "../../io/supabase/schemas/prospect-schema";
import { type Prospect, prospectId } from "../domain/entities";

export function mapProspectRow(row: unknown): Result<Prospect, AppError> {
  const parsed = ProspectRowSchema.safeParse(row);
  if (!parsed.success) {
    return err(ioError("SCHEMA_MISMATCH", `Prospect row validation failed: ${parsed.error.message}`, {
      issues: parsed.error.issues,
    }, "prospect-mapper"));
  }
  const r = parsed.data;
  return ok({
    id: prospectId(r.id),
    companyName: r.company_name,
    codiceAteco: r.codice_ateco,
    descrizioneAteco: r.descrizione_ateco,
    region: r.region,
    province: r.province,
    city: r.city,
    address: r.address,
    cap: r.cap,
    phone: r.phone,
    email: r.email,
    pec: r.pec,
    website: r.website,
    fatturato: r.fatturato,
    dipendenti: r.dipendenti,
    utile: r.utile,
    leadStatus: r.lead_status,
    source: r.source,
    interactionCount: r.interaction_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
}

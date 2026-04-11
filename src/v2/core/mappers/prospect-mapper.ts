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
    atecoCode: r.ateco_code,
    region: r.region,
    province: r.province,
    city: r.city,
    address: r.address,
    phone: r.phone,
    email: r.email,
    website: r.website,
    revenue: r.revenue,
    employees: r.employees,
    status: r.status,
    createdAt: r.created_at,
  });
}

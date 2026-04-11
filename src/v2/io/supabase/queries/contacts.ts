/**
 * IO Queries: Contacts — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type Contact } from "../../../core/domain/entities";
import { mapContactRow, mapContactRows } from "../../../core/mappers/contact-mapper";

export interface ContactFilters {
  readonly importLogId?: string;
  readonly leadStatus?: string;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export async function fetchContacts(
  filters?: ContactFilters,
): Promise<Result<Contact[], AppError>> {
  try {
    let query = supabase.from("imported_contacts").select("*");

    if (filters?.importLogId) {
      query = query.eq("import_log_id", filters.importLogId);
    }
    if (filters?.leadStatus) {
      query = query.eq("lead_status", filters.leadStatus);
    }
    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%`);
    }

    const limit = filters?.limit ?? 100;
    const offset = filters?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "imported_contacts",
      }, "fetchContacts"));
    }

    if (!data) return ok([]);
    return mapContactRows(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchContacts"));
  }
}

export async function fetchContactById(
  id: string,
): Promise<Result<Contact, AppError>> {
  try {
    const { data, error } = await supabase
      .from("imported_contacts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "imported_contacts", contactId: id,
      }, "fetchContactById"));
    }

    if (!data) {
      return err(ioError("NOT_FOUND", `Contact ${id} not found`, {
        contactId: id,
      }, "fetchContactById"));
    }

    return mapContactRow(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchContactById"));
  }
}

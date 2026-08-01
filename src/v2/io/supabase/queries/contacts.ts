/**
 * IO Queries: Contacts — facciata Result-based sul DAL canonico `src/data/contacts`.
 */
import {
  findContactsWindow,
  getContactById,
  countImportedContacts,
} from "@/data/contacts";
import { type Result, err } from "../../../core/domain/result";
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
    const rows = await findContactsWindow({
      importLogId: filters?.importLogId,
      leadStatus: filters?.leadStatus,
      search: filters?.search,
      limit: filters?.limit,
      offset: filters?.offset,
    });
    return mapContactRows(rows);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchContacts"));
  }
}

export async function fetchContactById(
  id: string,
): Promise<Result<Contact, AppError>> {
  try {
    const row = await getContactById(id);
    if (!row) {
      return err(ioError("NOT_FOUND", `Contact ${id} not found`, {
        contactId: id,
      }, "fetchContactById"));
    }
    return mapContactRow(row);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchContactById"));
  }
}

/* ── Raw exact count (Explore tab counters) ────────────── */
export async function fetchContactsCountRaw(): Promise<{
  count: number | null;
  error: { message: string } | null;
}> {
  try {
    return { count: await countImportedContacts(), error: null };
  } catch (caught: unknown) {
    return { count: null, error: { message: fromUnknown(caught, "DATABASE_ERROR", "fetchContactsCountRaw").message } };
  }
}

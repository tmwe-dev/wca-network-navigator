/**
 * IO Mutations: Contacts — facciata Result-based sul DAL canonico `src/data/contacts`.
 * Il DAL instrada `lead_status` sul percorso dedicato (`updateLeadStatus`).
 */
import {
  createImportedContact,
  updateContact as dalUpdateContact,
  updateLeadStatus,
  deleteContacts,
  getContactById,
} from "@/data/contacts";
import type { LeadStatus } from "@/data/contacts/types";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type Contact } from "../../../core/domain/entities";
import { mapContactRow } from "../../../core/mappers/contact-mapper";

export interface CreateContactInput {
  readonly import_log_id: string;
  readonly name?: string;
  readonly company_name?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly mobile?: string;
  readonly position?: string;
  readonly city?: string;
  readonly country?: string;
  readonly origin?: string;
  readonly lead_status?: string;
  readonly note?: string;
}

export async function createContact(
  input: CreateContactInput,
): Promise<Result<Contact, AppError>> {
  try {
    const row = await createImportedContact({ ...input });
    return mapContactRow(row);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "createContact"));
  }
}

export async function updateContact(
  contactId: string,
  updates: Partial<CreateContactInput>,
): Promise<Result<Contact, AppError>> {
  try {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined && k !== "lead_status") clean[k] = v;
    }
    if (Object.keys(clean).length > 0) {
      await dalUpdateContact(contactId, clean);
    }
    if (updates.lead_status !== undefined) {
      await updateLeadStatus([contactId], updates.lead_status as LeadStatus);
    }
    const row = await getContactById(contactId);
    if (!row) {
      return err(ioError("NOT_FOUND", `Contact ${contactId} not found`, {
        contactId, operation: "update",
      }, "updateContact"));
    }
    return mapContactRow(row);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "updateContact"));
  }
}

export async function deleteContact(
  contactId: string,
): Promise<Result<void, AppError>> {
  try {
    await deleteContacts([contactId]);
    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "deleteContact"));
  }
}

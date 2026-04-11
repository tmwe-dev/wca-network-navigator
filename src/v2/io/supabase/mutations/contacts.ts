/**
 * IO Mutations: Contacts — Result-based CRUD
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type Contact } from "../../../core/domain/entities";
import { mapContactRow } from "../../../core/mappers/contact-mapper";

export interface CreateContactInput {
  readonly import_log_id: string;
  readonly name?: string | null;
  readonly company_name?: string | null;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly mobile?: string | null;
  readonly position?: string | null;
  readonly city?: string | null;
  readonly country?: string | null;
  readonly origin?: string | null;
}

export async function createContact(
  input: CreateContactInput,
): Promise<Result<Contact, AppError>> {
  try {
    const { data, error } = await supabase
      .from("imported_contacts")
      .insert(input)
      .select()
      .single();

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "imported_contacts", operation: "insert",
      }, "createContact"));
    }

    return mapContactRow(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "createContact"));
  }
}

export async function updateContact(
  contactId: string,
  updates: Partial<CreateContactInput>,
): Promise<Result<Contact, AppError>> {
  try {
    const { data, error } = await supabase
      .from("imported_contacts")
      .update(updates)
      .eq("id", contactId)
      .select()
      .single();

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "imported_contacts", contactId, operation: "update",
      }, "updateContact"));
    }

    return mapContactRow(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "updateContact"));
  }
}

export async function deleteContact(
  contactId: string,
): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabase
      .from("imported_contacts")
      .delete()
      .eq("id", contactId);

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "imported_contacts", contactId, operation: "delete",
      }, "deleteContact"));
    }

    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "deleteContact"));
  }
}

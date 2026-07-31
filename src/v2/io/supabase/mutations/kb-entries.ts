/**
 * IO Mutations: KB Entries — Result-based.
 *
 * Unico punto di accesso ai dati: il DAL canonico `src/data/kbEntries.ts`.
 * Qui restano solo mapping di dominio e conversione errori → Result.
 */
import {
  insertKbEntryReturningRow,
  updateKbEntryRow,
  deleteKbEntry as deleteKbEntryRow,
} from "@/data/kbEntries";
import { type Result, ok, err } from "../../../core/domain/result";
import { fromUnknown, type AppError } from "../../../core/domain/errors";
import { type KbEntry } from "../../../core/domain/entities";
import { mapKbEntryRow } from "../../../core/mappers/kb-entry-mapper";
import type { Database } from "@/integrations/supabase/types";

type KbEntryInsert = Database["public"]["Tables"]["kb_entries"]["Insert"];
type KbEntryUpdate = Database["public"]["Tables"]["kb_entries"]["Update"];

export async function createKbEntry(input: KbEntryInsert): Promise<Result<KbEntry, AppError>> {
  try {
    return mapKbEntryRow(await insertKbEntryReturningRow(input));
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "createKbEntry"));
  }
}

export async function updateKbEntry(id: string, updates: KbEntryUpdate): Promise<Result<void, AppError>> {
  try {
    await updateKbEntryRow(id, updates);
    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "updateKbEntry"));
  }
}

export async function deleteKbEntry(id: string): Promise<Result<void, AppError>> {
  try {
    await deleteKbEntryRow(id);
    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "deleteKbEntry"));
  }
}

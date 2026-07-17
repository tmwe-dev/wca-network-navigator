/**
 * IO Mutations: KB Entries — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type KbEntry } from "../../../core/domain/entities";
import { mapKbEntryRow } from "../../../core/mappers/kb-entry-mapper";
import type { Database } from "@/integrations/supabase/types";

type KbEntryInsert = Database["public"]["Tables"]["kb_entries"]["Insert"];
type KbEntryUpdate = Database["public"]["Tables"]["kb_entries"]["Update"];

export async function createKbEntry(input: KbEntryInsert): Promise<Result<KbEntry, AppError>> {
  try {
    const { data, error } = await supabase.from("kb_entries").insert(input).select().single();
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "kb_entries" }, "createKbEntry"));
    return mapKbEntryRow(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "createKbEntry"));
  }
}

export async function updateKbEntry(id: string, updates: KbEntryUpdate): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabase.from("kb_entries").update(updates).eq("id", id);
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "kb_entries", id }, "updateKbEntry"));
    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "updateKbEntry"));
  }
}

export async function deleteKbEntry(id: string): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabase.from("kb_entries").delete().eq("id", id);
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "kb_entries", id }, "deleteKbEntry"));
    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "deleteKbEntry"));
  }
}

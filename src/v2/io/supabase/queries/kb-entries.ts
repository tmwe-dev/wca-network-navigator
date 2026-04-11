/**
 * IO Queries: KB Entries — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type KbEntry } from "../../../core/domain/entities";
import { mapKbEntryRow } from "../../../core/mappers/kb-entry-mapper";

export async function fetchKbEntries(): Promise<Result<KbEntry[], AppError>> {
  try {
    const { data, error } = await supabase
      .from("kb_entries")
      .select("*")
      .order("priority", { ascending: false });
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "kb_entries" }, "fetchKbEntries"));
    if (!data) return ok([]);
    const entries: KbEntry[] = [];
    for (const row of data) {
      const mapped = mapKbEntryRow(row);
      if (mapped._tag === "Err") return mapped;
      entries.push(mapped.value);
    }
    return ok(entries);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchKbEntries"));
  }
}

export async function searchKbEntries(query: string): Promise<Result<KbEntry[], AppError>> {
  try {
    const { data, error } = await supabase
      .from("kb_entries")
      .select("*")
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order("priority", { ascending: false })
      .limit(50);
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "kb_entries", query }, "searchKbEntries"));
    if (!data) return ok([]);
    const entries: KbEntry[] = [];
    for (const row of data) {
      const mapped = mapKbEntryRow(row);
      if (mapped._tag === "Err") return mapped;
      entries.push(mapped.value);
    }
    return ok(entries);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "searchKbEntries"));
  }
}

/**
 * IO Queries: KB Entries — Result-based.
 *
 * Unico punto di accesso ai dati: il DAL canonico `src/data/kbEntries.ts`.
 * Qui restano solo mapping di dominio e conversione errori → Result.
 */
import { findKbEntryRowsByPriority, searchKbEntryRows } from "@/data/kbEntries";
import { type Result, ok, err } from "../../../core/domain/result";
import { fromUnknown, type AppError } from "../../../core/domain/errors";
import { type KbEntry } from "../../../core/domain/entities";
import { mapKbEntryRow } from "../../../core/mappers/kb-entry-mapper";

function mapRows(rows: readonly unknown[]): Result<KbEntry[], AppError> {
  const entries: KbEntry[] = [];
  for (const row of rows) {
    const mapped = mapKbEntryRow(row);
    if (mapped._tag === "Err") return mapped;
    entries.push(mapped.value);
  }
  return ok(entries);
}

export async function fetchKbEntries(): Promise<Result<KbEntry[], AppError>> {
  try {
    return mapRows(await findKbEntryRowsByPriority());
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchKbEntries"));
  }
}

export async function searchKbEntries(query: string): Promise<Result<KbEntry[], AppError>> {
  try {
    return mapRows(await searchKbEntryRows(query, 50));
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "searchKbEntries"));
  }
}

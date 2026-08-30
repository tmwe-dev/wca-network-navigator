/**
 * DAL V3 — Import (Modulo 2, Contatti).
 *
 * Lettura dello storico `import_logs` + rilancio dell'elaborazione AI
 * (`process-ai-import`) sui file già caricati. Il caricamento di nuovi file
 * resta nella superficie V2 dedicata: qui si governa ciò che è già entrato.
 */
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";

export interface V3ImportLog {
  readonly id: string;
  readonly nomeFile: string;
  readonly gruppo: string | null;
  readonly stato: string;
  readonly righeTotali: number;
  readonly righeImportate: number;
  readonly righeErrore: number;
  readonly batch: number;
  readonly batchTotali: number;
  readonly metodo: string;
  readonly creatoIl: string | null;
  readonly completatoIl: string | null;
}

export interface V3ImportFiltri {
  readonly stato?: string | null;
  readonly pagina: number;
  readonly perPagina: number;
}

export interface V3ImportPagina {
  readonly righe: readonly V3ImportLog[];
  readonly totale: number;
}

export async function listImportLogsV3(filtri: V3ImportFiltri): Promise<V3ImportPagina> {
  const perPagina = Math.min(Math.max(filtri.perPagina, 1), 100);
  const from = Math.max(filtri.pagina, 0) * perPagina;

  let query = supabase
    .from("import_logs")
    .select(
      "id, file_name, group_name, status, total_rows, imported_rows, error_rows, processing_batch, total_batches, normalization_method, created_at, completed_at",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + perPagina - 1);

  if (filtri.stato) query = query.eq("status", filtri.stato);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    righe: (data ?? []).map((row) => ({
      id: String(row.id),
      nomeFile: String(row.file_name ?? "file"),
      gruppo: (row.group_name as string | null) ?? null,
      stato: String(row.status ?? "unknown"),
      righeTotali: (row.total_rows as number | null) ?? 0,
      righeImportate: (row.imported_rows as number | null) ?? 0,
      righeErrore: (row.error_rows as number | null) ?? 0,
      batch: (row.processing_batch as number | null) ?? 0,
      batchTotali: (row.total_batches as number | null) ?? 0,
      metodo: String(row.normalization_method ?? "—"),
      creatoIl: (row.created_at as string | null) ?? null,
      completatoIl: (row.completed_at as string | null) ?? null,
    })),
    totale: count ?? 0,
  };
}

/** Rilancia l'elaborazione AI su un import già caricato. */
export async function processaImportV3(importLogId: string): Promise<void> {
  await invokeEdge<Record<string, unknown>>("process-ai-import", {
    body: { import_log_id: importLogId },
    context: "v3-import",
  });
}

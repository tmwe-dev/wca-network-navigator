/**
 * DAL — finder_api_schema_map
 * Mappa campi/ruoli per ogni operazione TMWE consentita.
 * Iniettata nel system prompt di finder-api-chat per evitare ricerche cieche.
 */
import { tFrom } from "@/lib/typedSupabase";

export type SchemaRole =
  | "id_interno"
  | "tracking_code"
  | "data"
  | "stato"
  | "note"
  | "servizio"
  | "cliente"
  | "contatto"
  | "altro";

export interface FinderApiSchemaField {
  id: string;
  op: string;
  field: string;
  role: SchemaRole;
  description: string | null;
  example: string | null;
  sample_value: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export const finderApiSchemaKeys = {
  all: ["finder_api_schema_map"] as const,
  list: () => ["finder_api_schema_map", "list"] as const,
};

export async function listFinderApiSchemaMap(): Promise<FinderApiSchemaField[]> {
  const { data, error } = await tFrom("finder_api_schema_map")
    .select("id, op, field, role, description, example, sample_value, verified_at, created_at, updated_at")
    .order("op", { ascending: true })
    .order("field", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as FinderApiSchemaField[];
}

export async function upsertFinderApiSchemaField(payload: {
  op: string;
  field: string;
  role: SchemaRole;
  description?: string | null;
  example?: string | null;
  sample_value?: string | null;
}): Promise<void> {
  const { error } = await tFrom("finder_api_schema_map")
    .upsert(
      {
        op: payload.op,
        field: payload.field,
        role: payload.role,
        description: payload.description ?? null,
        example: payload.example ?? null,
        sample_value: payload.sample_value ?? null,
        verified_at: new Date().toISOString(),
      } as never,
      { onConflict: "op,field" } as never,
    );
  if (error) throw error;
}

export async function deleteFinderApiSchemaField(id: string): Promise<void> {
  const { error } = await tFrom("finder_api_schema_map").delete().eq("id", id);
  if (error) throw error;
}

/** Ingest helper: dato un sample (oggetto piatto) e un'op, registra i campi mancanti con role 'altro'. */
export async function ingestSampleIntoSchemaMap(
  op: string,
  sample: Record<string, unknown>,
): Promise<{ added: number; skipped: number }> {
  const existing = await listFinderApiSchemaMap();
  const known = new Set(existing.filter((e) => e.op === op).map((e) => e.field));
  let added = 0;
  let skipped = 0;
  for (const [field, value] of Object.entries(sample)) {
    if (known.has(field)) { skipped++; continue; }
    const example = value === null || value === undefined ? "" : String(value).slice(0, 80);
    await upsertFinderApiSchemaField({
      op,
      field,
      role: "altro",
      description: null,
      example,
      sample_value: example,
    });
    added++;
  }
  return { added, skipped };
}
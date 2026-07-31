/**
 * DAL — imported_contacts (CSV import wizard + prospect pipeline V2).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ImportedContactInsert = Database["public"]["Tables"]["imported_contacts"]["Insert"];

/** Batch insert (usato dal wizard di import CSV). */
export async function insertImportedContactsBatch(batch: ImportedContactInsert[]): Promise<{ error: boolean }> {
  const { error } = await supabase.from("imported_contacts").insert(batch);
  return { error: !!error };
}

export interface ProspectPipelineRow {
  readonly id: string;
  readonly name: string | null;
  readonly company_name: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly mobile: string | null;
  readonly lead_status: string;
  readonly country: string | null;
  readonly origin: string | null;
  readonly created_at: string;
}

/** Pipeline prospect (imported_contacts) filtrata per status/ricerca. */
export async function findProspectPipeline(status?: string, search?: string): Promise<ProspectPipelineRow[]> {
  let q = supabase
    .from("imported_contacts")
    .select("id, name, company_name, email, phone, mobile, lead_status, country, origin, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("lead_status", status);
  if (search) q = q.or(`name.ilike.%${search}%,company_name.ilike.%${search}%`);
  const { data, error } = await q;
  if (error) return [];
  return data ?? [];
}

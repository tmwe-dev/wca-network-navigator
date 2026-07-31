/**
 * DAL — Queries for useContactMerge.
 */
import { supabase } from "@/integrations/supabase/client";
import { tFrom } from "@/lib/typedSupabase";
import type { Database } from "@/integrations/supabase/types";

type ImportedContactsRow = Database["public"]["Tables"]["imported_contacts"]["Row"];
type ImportedContactsUpdate = Database["public"]["Tables"]["imported_contacts"]["Update"];

export async function getImportedContactById(id: string): Promise<ImportedContactsRow> {
  const { data, error } = await supabase.from("imported_contacts").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ImportedContactsRow;
}

export async function updateImportedContact(id: string, patch: ImportedContactsUpdate): Promise<void> {
  const { error } = await supabase.from("imported_contacts").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * `activities.contact_id` / `emails` non sono nei tipi generati: si mantiene
 * l'accesso untyped centralizzato (`tFrom`) usato in origine dal chiamante.
 */
export async function reassignActivitiesContact(fromContactId: string, toContactId: string): Promise<{ error: { message: string } | null }> {
  const { error } = await tFrom("activities").update({ contact_id: toContactId }).eq("contact_id", fromContactId);
  return { error };
}

export async function reassignEmailsContact(fromContactId: string, toContactId: string): Promise<{ error: { message: string } | null }> {
  const { error } = await tFrom("emails").update({ contact_id: toContactId }).eq("contact_id", fromContactId);
  return { error };
}

export async function deleteImportedContact(id: string): Promise<void> {
  const { error } = await supabase.from("imported_contacts").delete().eq("id", id);
  if (error) throw error;
}

export interface ContactForMergeRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  company_name: string | null;
  company_id: string | null;
  title: string | null;
  country: string | null;
  created_at: string;
  interaction_count: number | null;
}

export async function findContactsForDuplicateScan(): Promise<ContactForMergeRow[]> {
  const { data, error } = await supabase
    .from("imported_contacts")
    .select("id, name, email, phone, mobile, company_name, company_id, title, country, created_at, interaction_count")
    .or("company_name.not.is.null,name.not.is.null,email.not.is.null")
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as unknown as ContactForMergeRow[];
}

export async function countImportedContactsForMerge(): Promise<number> {
  const { count, error } = await supabase.from("imported_contacts").select("id", { count: "exact", head: true });
  if (error) throw error;
  return count || 0;
}

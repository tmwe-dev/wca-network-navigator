/**
 * DAL — restore-contact tool della Command page (undo soft-delete su imported_contacts).
 */
import { supabase } from "@/integrations/supabase/client";

export async function restoreContactById(
  id: string,
): Promise<{ error: { message: string } | null; count: number | null }> {
  return await supabase
    .from("imported_contacts")
    .update({ deleted_at: null, deleted_by: null }, { count: "exact" })
    .eq("id", id);
}

export async function restoreContactByTerm(
  term: string,
): Promise<{ error: { message: string } | null; count: number | null }> {
  return await supabase
    .from("imported_contacts")
    .update({ deleted_at: null, deleted_by: null }, { count: "exact" })
    .or(`email.ilike.%${term}%,name.ilike.%${term}%`);
}

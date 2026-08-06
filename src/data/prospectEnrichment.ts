/**
 * DAL — enrich-prospect-from-website tool della Command page.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProspectRow = Database["public"]["Tables"]["prospects"]["Row"];
type ProspectUpdate = Database["public"]["Tables"]["prospects"]["Update"];

export async function fetchProspectById(
  id: string,
): Promise<{ data: ProspectRow | null; error: { message: string } | null }> {
  return await supabase.from("prospects").select("*").eq("id", id).maybeSingle();
}

export async function updateProspect(
  id: string,
  updates: ProspectUpdate,
): Promise<{ error: { message: string } | null }> {
  return await supabase.from("prospects").update(updates).eq("id", id);
}

/**
 * DAL — workspace_documents
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type DocInsert = Database["public"]["Tables"]["workspace_documents"]["Insert"];

export async function findWorkspaceDocs() {
  const { data, error } = await supabase.from("workspace_documents").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createWorkspaceDoc(doc: DocInsert) {
  const { error } = await supabase.from("workspace_documents").insert(doc);
  if (error) throw error;
}

export async function deleteWorkspaceDoc(id: string) {
  const { error } = await supabase.from("workspace_documents").delete().eq("id", id);
  if (error) throw error;
}

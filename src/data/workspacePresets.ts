/**
 * DAL — workspace_presets (preset di workspace per utente).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WorkspacePresetRow = Database["public"]["Tables"]["workspace_presets"]["Row"];

export interface WorkspacePresetInput {
  name: string;
  goal: string;
  base_proposal: string;
  document_ids: string[];
  reference_links: string[];
}

export async function findWorkspacePresets(userId: string): Promise<WorkspacePresetRow[]> {
  const { data, error } = await supabase
    .from("workspace_presets")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateWorkspacePreset(id: string, input: WorkspacePresetInput): Promise<void> {
  const { error } = await supabase
    .from("workspace_presets")
    .update({
      name: input.name,
      goal: input.goal,
      base_proposal: input.base_proposal,
      document_ids: input.document_ids,
      reference_links: input.reference_links,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function insertWorkspacePreset(userId: string, input: WorkspacePresetInput): Promise<void> {
  const { error } = await supabase.from("workspace_presets").insert({
    user_id: userId,
    name: input.name,
    goal: input.goal,
    base_proposal: input.base_proposal,
    document_ids: input.document_ids,
    reference_links: input.reference_links,
  });
  if (error) throw error;
}

export async function deleteWorkspacePreset(id: string): Promise<void> {
  const { error } = await supabase.from("workspace_presets").delete().eq("id", id);
  if (error) throw error;
}

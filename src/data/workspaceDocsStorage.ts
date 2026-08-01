/**
 * DAL — Storage bucket "workspace-docs".
 */
import { supabase } from "@/integrations/supabase/client";

export async function uploadWorkspaceDocFile(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from("workspace-docs").upload(path, file);
  if (error) throw error;
}

export async function createWorkspaceDocSignedUrl(path: string, expiresInSeconds: number): Promise<string | null> {
  const { data } = await supabase.storage.from("workspace-docs").createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}

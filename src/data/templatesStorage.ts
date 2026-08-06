/**
 * DAL — Storage bucket "templates" (allegati/documenti generali + immagini firma).
 */
import { supabase } from "@/integrations/supabase/client";

/** Rimuove un file dal bucket templates. */
export async function removeTemplateFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from("templates").remove([path]);
  if (error) throw error;
}

/** Carica un file nel bucket templates. */
export async function uploadTemplateFile(path: string, file: File, options?: { upsert?: boolean }): Promise<void> {
  const { error } = await supabase.storage.from("templates").upload(path, file, options);
  if (error) throw error;
}

/** URL firmato temporaneo per un file del bucket templates. */
export async function createTemplateSignedUrl(path: string, expiresInSeconds: number): Promise<string | null> {
  const { data } = await supabase.storage.from("templates").createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}

/** URL pubblico per un file del bucket templates. */
export function getTemplatePublicUrl(path: string): string {
  const { data } = supabase.storage.from("templates").getPublicUrl(path);
  return data.publicUrl;
}

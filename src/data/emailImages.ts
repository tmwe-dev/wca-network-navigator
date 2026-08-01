/**
 * DAL — Storage bucket "email-images" (galleria immagini per composer email).
 */
import { supabase } from "@/integrations/supabase/client";

export interface EmailImageFile {
  name: string;
  created_at: string;
}

/** Elenca i file presenti nel bucket email-images. */
export async function listEmailImages(): Promise<EmailImageFile[]> {
  const { data, error } = await supabase.storage.from("email-images").list("", {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) throw error;
  return (data ?? []).map((f) => ({ name: f.name, created_at: f.created_at || "" }));
}

/** URL pubblico per un file del bucket email-images. */
export function getEmailImagePublicUrl(name: string): string {
  const { data } = supabase.storage.from("email-images").getPublicUrl(name);
  return data.publicUrl;
}

/** Carica un'immagine nel bucket email-images. */
export async function uploadEmailImage(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from("email-images").upload(path, file, { contentType: file.type });
  if (error) throw error;
}

/** Elimina un'immagine dal bucket email-images. */
export async function removeEmailImage(name: string): Promise<void> {
  const { error } = await supabase.storage.from("email-images").remove([name]);
  if (error) throw error;
}

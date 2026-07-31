/**
 * DAL — Storage bucket "cockpit-attachments" (allegati bozze cockpit).
 */
import { supabase } from "@/integrations/supabase/client";

/** Carica un allegato nel bucket cockpit-attachments. */
export async function uploadCockpitAttachment(path: string, file: File, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from("cockpit-attachments").upload(path, file, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
}

/** Rimuove un allegato dal bucket cockpit-attachments. */
export async function removeCockpitAttachment(path: string): Promise<void> {
  const { error } = await supabase.storage.from("cockpit-attachments").remove([path]);
  if (error) throw error;
}

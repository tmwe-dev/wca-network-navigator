/**
 * DAL — Storage bucket "email-images" per lo step Allegati del Mission Builder.
 */
import { supabase } from "@/integrations/supabase/client";

export interface MissionAttachmentImage { name: string; url: string }

/** Elenca le immagini disponibili (bucket email-images) per l'allegato missione. */
export async function listMissionAttachmentImages(): Promise<MissionAttachmentImage[]> {
  const { data: files } = await supabase.storage.from("email-images").list("", {
    limit: 50,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (!files) return [];
  return files
    .filter((f) => f.name && !f.name.startsWith("."))
    .map((f) => {
      const { data: urlData } = supabase.storage.from("email-images").getPublicUrl(f.name);
      return { name: f.name, url: urlData.publicUrl };
    });
}

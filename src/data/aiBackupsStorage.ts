/**
 * DAL — Storage bucket "ai-backups".
 */
import { supabase } from "@/integrations/supabase/client";

export interface AiBackupFile {
  name: string;
  created_at: string;
}

/** Elenca i backup di un utente, dal più recente. */
export async function listAiBackups(userId: string): Promise<AiBackupFile[]> {
  const { data } = await supabase.storage
    .from("ai-backups")
    .list(userId, { sortBy: { column: "created_at", order: "desc" } });
  return (data as AiBackupFile[]) || [];
}

/** Scarica un backup come Blob. */
export async function downloadAiBackup(userId: string, fileName: string): Promise<Blob | null> {
  const { data } = await supabase.storage.from("ai-backups").download(`${userId}/${fileName}`);
  return data ?? null;
}

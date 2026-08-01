/**
 * DAL — storage bucket "chat-attachments"
 */
import { supabase } from "@/integrations/supabase/client";

export async function uploadChatAttachment(path: string, file: File, options?: { contentType?: string }): Promise<{ error: Error | null }> {
  const { error } = await supabase.storage.from("chat-attachments").upload(path, file, options);
  return { error };
}

export function getChatAttachmentPublicUrl(path: string): string {
  const { data } = supabase.storage.from("chat-attachments").getPublicUrl(path);
  return data.publicUrl;
}

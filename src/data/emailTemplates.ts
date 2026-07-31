/**
 * DAL — email_templates
 */
import { supabase } from "@/integrations/supabase/client";

export async function findEmailTemplates() {
  const { data, error } = await supabase.from("email_templates").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function findEmailTemplatesShort(limit = 20) {
  const { data, error } = await supabase.from("email_templates").select("id, name, file_url").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function createEmailTemplate(template: { name: string; file_name: string; file_url: string; file_size: number; file_type: string; category?: string; user_id?: string | null }) {
  const { error } = await supabase.from("email_templates").insert(template);
  if (error) throw error;
}

export async function deleteEmailTemplate(id: string) {
  const { error } = await supabase.from("email_templates").delete().eq("id", id);
  if (error) throw error;
}

/** Tutti i template email, più recenti prima. */
export async function findAllEmailTemplates() {
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── Storage bucket "email-images" ──
export interface EmailImageEntry { name: string; url: string }

export async function listEmailImages(limit = 50): Promise<EmailImageEntry[]> {
  const { data: files } = await supabase.storage
    .from("email-images")
    .list("", { limit, sortBy: { column: "created_at", order: "desc" } });
  if (!files) return [];
  return files
    .filter((f) => f.name && !f.name.startsWith("."))
    .map((f) => {
      const { data: urlData } = supabase.storage.from("email-images").getPublicUrl(f.name);
      return { name: f.name, url: urlData.publicUrl };
    });
}

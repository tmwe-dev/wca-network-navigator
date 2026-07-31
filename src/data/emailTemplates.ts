/**
 * DAL — email_prompts (composer templates)
 */
import { supabase } from "@/integrations/supabase/client";

export async function findActiveEmailPrompts(limit = 20) {
  const { data } = await supabase
    .from("email_prompts")
    .select("id, title, instructions, scope")
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/**
 * DAL — email_templates (documenti allegabili caricati dagli operatori).
 */
export interface EmailTemplateRow {
  id: string;
  name: string;
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  category: string | null;
  created_at: string;
}

export interface EmailTemplateInput {
  name: string;
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  category: string;
}

const EMAIL_TEMPLATE_SELECT = "id, name, file_url, file_name, file_size, file_type, category, created_at";

/** Elenco completo dei template, dal più recente. */
export async function findEmailTemplates(): Promise<EmailTemplateRow[]> {
  const { data, error } = await supabase
    .from("email_templates")
    .select(EMAIL_TEMPLATE_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Alias usato dalle campagne: stesso elenco completo. */
export async function findAllEmailTemplates(): Promise<EmailTemplateRow[]> {
  return findEmailTemplates();
}

/** Proiezione ridotta (id, name, file_url) per i picker allegati. */
export async function findEmailTemplatesShort(): Promise<Array<Pick<EmailTemplateRow, "id" | "name" | "file_url">>> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("id, name, file_url")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createEmailTemplate(input: EmailTemplateInput): Promise<void> {
  const { error } = await supabase.from("email_templates").insert(input);
  if (error) throw error;
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("email_templates").delete().eq("id", id);
  if (error) throw error;
}

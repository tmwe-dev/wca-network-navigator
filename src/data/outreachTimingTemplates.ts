/**
 * DAL for outreach_timing_templates
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toJsonValue } from "@/lib/jsonGuards";

export interface TimingStep {
  step: number;
  channel: string;
  delay_days: number;
  trigger: string;
  tone: string;
  template_hint: string;
}

export interface TimingTemplate {
  id: string;
  user_id: string | null;
  template_name: string;
  description: string | null;
  is_system: boolean;
  source_type: string;
  goal: string;
  sequence: TimingStep[];
  max_attempts: number;
  total_duration_days: number | null;
  preferred_language: string;
  auto_translate: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchTimingTemplates(): Promise<TimingTemplate[]> {
  const { data, error } = await supabase
    .from("outreach_timing_templates")
    .select("*")
    .order("is_system", { ascending: false })
    .order("template_name");
  if (error) throw error;
  return (data ?? []) as unknown as TimingTemplate[]; // drift: sequence is Json in DB vs TimingStep[] in domain type
}

export async function createTimingTemplate(
  tpl: Omit<TimingTemplate, "id" | "created_at" | "updated_at">
): Promise<TimingTemplate> {
  const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
  if (!user) throw new Error("Not authenticated");

  const insertRow: Database["public"]["Tables"]["outreach_timing_templates"]["Insert"] = {
    ...tpl,
    sequence: toJsonValue(tpl.sequence),
    user_id: user.id,
    is_system: false,
  };
  const { data, error } = await supabase
    .from("outreach_timing_templates")
    .insert(insertRow)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as TimingTemplate; // drift: sequence is Json in DB vs TimingStep[] in domain type
}

export async function duplicateTimingTemplate(id: string): Promise<TimingTemplate> {
  const templates = await fetchTimingTemplates();
  const source = templates.find((t) => t.id === id);
  if (!source) throw new Error("Template not found");

  return createTimingTemplate({
    user_id: null,
    template_name: `${source.template_name} (copia)`,
    description: source.description,
    is_system: false,
    source_type: source.source_type,
    goal: source.goal,
    sequence: source.sequence,
    max_attempts: source.max_attempts,
    total_duration_days: source.total_duration_days,
    preferred_language: source.preferred_language,
    auto_translate: source.auto_translate,
  });
}

export async function deleteTimingTemplate(id: string) {
  const { error } = await supabase
    .from("outreach_timing_templates")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

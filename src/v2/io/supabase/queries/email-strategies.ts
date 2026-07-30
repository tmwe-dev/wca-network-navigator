/**
 * DAL v2 — Strategie email: template autoresponder e regole di risveglio.
 * Estratto da `EmailStrategiesPage` per rimuovere query dirette dalla UI.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AutoTemplateRow {
  id: string;
  name: string;
  language: string;
  subject_template: string;
  body_template: string;
  enabled: boolean;
  notes: string | null;
}

export interface WakeRuleRow {
  id: string;
  name: string;
  group_name: string | null;
  min_score: number;
  days_dormant: number;
  channel: string;
  max_per_day: number;
  is_active: boolean;
  notes: string | null;
}

const AUTO_COLS = "id, name, language, subject_template, body_template, enabled, notes";
const WAKE_COLS =
  "id, name, group_name, min_score, days_dormant, channel, max_per_day, is_active, notes";

export async function listAutoresponderTemplates(): Promise<AutoTemplateRow[]> {
  const { data, error } = await supabase
    .from("funnemail_autoresponder_templates")
    .select(AUTO_COLS)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AutoTemplateRow[];
}

export async function updateAutoresponderTemplate(
  id: string,
  patch: Partial<Omit<AutoTemplateRow, "id">>,
): Promise<void> {
  const { error } = await supabase
    .from("funnemail_autoresponder_templates")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function insertAutoresponderTemplate(
  row: Omit<AutoTemplateRow, "id">,
): Promise<void> {
  const { error } = await supabase.from("funnemail_autoresponder_templates").insert(row);
  if (error) throw error;
}

export async function deleteAutoresponderTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("funnemail_autoresponder_templates")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function listWakeUpRules(): Promise<WakeRuleRow[]> {
  const { data, error } = await supabase
    .from("wake_up_rules")
    .select(WAKE_COLS)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WakeRuleRow[];
}

export async function updateWakeUpRule(
  id: string,
  patch: Partial<Omit<WakeRuleRow, "id">>,
): Promise<void> {
  const { error } = await supabase.from("wake_up_rules").update(patch).eq("id", id);
  if (error) throw error;
}

export async function insertWakeUpRule(
  row: Omit<WakeRuleRow, "id"> & { user_id: string },
): Promise<void> {
  const { error } = await supabase.from("wake_up_rules").insert(row);
  if (error) throw error;
}

/** Soft-delete conforme alla policy "no physical delete". */
export async function softDeleteWakeUpRule(id: string): Promise<void> {
  const { error } = await supabase
    .from("wake_up_rules")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
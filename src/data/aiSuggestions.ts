/**
 * DAL — suggerimenti AI sui mittenti (tab "AI Suggestions").
 * Estratto 1:1 da `AISuggestionsTab`: stessi select, filtri, order e limit.
 */
import { supabase } from "@/integrations/supabase/client";

export interface SuggestionAddressRow {
  id: string;
  email_address: string;
  display_name: string | null;
  company_name: string | null;
  domain: string | null;
  email_count: number | null;
  group_id: string | null;
  group_name: string | null;
  group_color: string | null;
  group_icon: string | null;
  ai_suggested_group: string | null;
  ai_suggestion_confidence: number | null;
}

const SUGGESTION_COLS =
  "id, email_address, display_name, company_name, domain, email_count, group_id, group_name, group_color, group_icon, ai_suggested_group, ai_suggestion_confidence";

export type SuggestionStatusFilter = "uncategorized" | "categorized" | string;

/** Regole indirizzo per il tab suggerimenti. Errori propagati (throw). */
export async function findSuggestionAddressRules(params: {
  statusFilter: SuggestionStatusFilter;
  minEmailCount: number;
}): Promise<SuggestionAddressRow[]> {
  let q = supabase
    .from("email_address_rules")
    .select(SUGGESTION_COLS)
    .gte("email_count", params.minEmailCount)
    .order("email_count", { ascending: false })
    .limit(500);

  if (params.statusFilter === "uncategorized") q = q.is("group_id", null).is("group_name", null);
  else if (params.statusFilter === "categorized") q = q.or("group_id.not.is.null,group_name.not.is.null");

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SuggestionAddressRow[];
}

export interface SuggestionGroupAssignment {
  group_id: string;
  group_name: string;
  group_color?: string | null;
  group_icon?: string | null;
  ai_suggestion_accepted: boolean;
}

/** Assegna il gruppo (accettazione suggerimento o scelta manuale). */
export async function assignSuggestionGroup(ruleId: string, patch: SuggestionGroupAssignment): Promise<void> {
  await supabase.from("email_address_rules").update(patch).eq("id", ruleId);
}

/** Ignora il suggerimento AI per una regola indirizzo. */
export async function clearAiSuggestion(ruleId: string): Promise<void> {
  await supabase
    .from("email_address_rules")
    .update({ ai_suggestion_accepted: false, ai_suggested_group: null })
    .eq("id", ruleId);
}

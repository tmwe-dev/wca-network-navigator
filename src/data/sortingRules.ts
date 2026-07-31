/**
 * DAL — email_address_rules (sorting rules)
 */
import { supabase } from "@/integrations/supabase/client";

export async function findEmailAddressRules() {
  const { data, error } = await supabase
    .from("email_address_rules")
    .select("*")
    .order("priority", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function setEmailAddressRuleCategory(id: string, category: "active" | "inactive"): Promise<void> {
  const { error } = await supabase.from("email_address_rules").update({ category }).eq("id", id);
  if (error) throw error;
}

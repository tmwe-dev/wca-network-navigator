/**
 * DAL — email_address_rules
 */
import { supabase } from "@/integrations/supabase/client";

export interface EmailAddressRule {
  id: string;
  user_id: string;
  email_address: string;
  display_name: string | null;
  category: string | null;
  group_name: string | null;
  custom_prompt: string | null;
  notes: string | null;
  is_active: boolean | null;
  priority: number | null;
}

export async function findEmailAddressRules(userId: string): Promise<EmailAddressRule[]> {
  const { data, error } = await supabase
    .from("email_address_rules")
    .select("id, user_id, email_address, display_name, category, group_name, custom_prompt, notes, is_active, priority")
    .eq("user_id", userId)
    .order("priority", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmailAddressRule[];
}

export async function updateEmailAddressRule(id: string, patch: Partial<EmailAddressRule>): Promise<void> {
  const { error } = await supabase.from("email_address_rules").update(patch).eq("id", id);
  if (error) throw error;
}
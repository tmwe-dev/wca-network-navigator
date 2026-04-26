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
  auto_action: string | null;
  auto_action_params: Record<string, unknown> | null;
  applied_count: number | null;
  last_applied_at: string | null;
}

export async function findEmailAddressRules(userId: string): Promise<EmailAddressRule[]> {
  const { data, error } = await supabase
    .from("email_address_rules")
    .select("id, user_id, email_address, display_name, category, group_name, custom_prompt, notes, is_active, priority, auto_action, auto_action_params, applied_count, last_applied_at")
    .eq("user_id", userId)
    .order("priority", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmailAddressRule[];
}

export async function updateEmailAddressRule(id: string, patch: Partial<EmailAddressRule>): Promise<void> {
  // Cast controllato: `auto_action_params` qui è Record<string, unknown> ma il tipo
  // generato di Supabase è `Json` (ricorsivo). Sono compatibili a runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("email_address_rules").update(patch as any).eq("id", id);
  if (error) throw error;
}
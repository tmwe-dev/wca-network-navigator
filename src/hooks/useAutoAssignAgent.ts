import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";

const log = createLogger("useAutoAssignAgent");

/**
 * Auto-assign an agent (and optional manager) to a contact based on:
 * 1. Exclusive agent already locked to the email address
 * 2. Territory match (country_code)
 * 3. Sales/outreach fallback
 * 4. First active agent
 *
 * Also locks the exclusive_agent_id on email_address_rules if not set.
 */
export async function autoAssignAgent(params: {
  sourceId: string;
  sourceType: string;
  countryCode: string | null;
  emailAddress?: string | null;
  userId: string;
}): Promise<void> {
  const { sourceId, sourceType, countryCode, emailAddress, userId } = params;

  // Check if already assigned
  const { data: existing } = await supabase
    .from("client_assignments")
    .select("id")
    .eq("source_id", sourceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return;

  // Fetch all active agents for this user
  const { data: agents } = await supabase
    .from("agents")
    .select("id, role, territory_codes")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (!agents || agents.length === 0) return;

  const typedAgents = agents as Array<{
    id: string;
    role: string;
    territory_codes: string[] | null;
  }>;

  let matchedAgent: typeof typedAgents[0] | null = null;

  // 0. Check exclusive agent locked to this email address
  if (emailAddress) {
    const { data: rule } = await supabase
      .from("email_address_rules")
      .select("exclusive_agent_id")
      .eq("email_address", emailAddress.toLowerCase().trim())
      .eq("user_id", userId)
      .not("exclusive_agent_id", "is", null)
      .maybeSingle();

    if (rule?.exclusive_agent_id) {
      matchedAgent = typedAgents.find(a => a.id === rule.exclusive_agent_id) || null;
    }
  }

  // 1. Find agent by territory match
  if (!matchedAgent && countryCode) {
    const cc = countryCode.toUpperCase().trim();
    matchedAgent = typedAgents.find(a =>
      Array.isArray(a.territory_codes) && a.territory_codes.some(t => t.toUpperCase().trim() === cc)
    ) || null;
  }

  // 2. Fallback: first sales/outreach agent
  if (!matchedAgent) {
    matchedAgent = typedAgents.find(a =>
      ["sales", "outreach"].includes(a.role?.toLowerCase())
    ) || null;
  }

  // 3. Ultimate fallback: first agent
  if (!matchedAgent) {
    matchedAgent = typedAgents[0];
  }

  // Find manager
  const manager = typedAgents.find(a =>
    a.role?.toLowerCase().includes("manager") && a.id !== matchedAgent!.id
  );

  const { error } = await supabase
    .from("client_assignments")
    .insert({
      source_id: sourceId,
      source_type: sourceType,
      agent_id: matchedAgent.id,
      manager_id: manager?.id || null,
      user_id: userId,
    });

  if (error) {
    log.warn("assign agent failed", { message: error.message });
    return;
  }

  // Lock exclusive agent on the email address if not already set
  if (emailAddress && matchedAgent) {
    const addr = emailAddress.toLowerCase().trim();
    const { data: existingRule } = await supabase
      .from("email_address_rules")
      .select("id, exclusive_agent_id")
      .eq("email_address", addr)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingRule && !existingRule.exclusive_agent_id) {
      await supabase
        .from("email_address_rules")
        .update({ exclusive_agent_id: matchedAgent.id })
        .eq("id", existingRule.id);
    } else if (!existingRule) {
      await supabase
        .from("email_address_rules")
        .insert({
          email_address: addr,
          user_id: userId,
          exclusive_agent_id: matchedAgent.id,
          category: "auto",
          display_name: null,
        });
    }
  }
}

import { createLogger } from "@/lib/log";
import { findClientAssignment, insertClientAssignment } from "@/data/clientAssignments";
import { findAssignableAgents, type AssignableAgent } from "@/data/agents";
import {
  findExclusiveAgentForAddress,
  findAddressRuleForUser,
  setAddressRuleExclusiveAgent,
  insertAddressRule,
} from "@/data/emailAddressRules";

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
  const existing = await findClientAssignment(sourceId, userId);
  if (existing) return;

  // Fetch all active agents for this user
  const typedAgents = await findAssignableAgents(userId);
  if (typedAgents.length === 0) return;

  let matchedAgent: AssignableAgent | null = null;

  // 0. Check exclusive agent locked to this email address
  if (emailAddress) {
    const exclusiveAgentId = await findExclusiveAgentForAddress(
      emailAddress.toLowerCase().trim(),
      userId,
    );
    if (exclusiveAgentId) {
      matchedAgent = typedAgents.find(a => a.id === exclusiveAgentId) || null;
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

  const insertError = await insertClientAssignment({
    source_id: sourceId,
    source_type: sourceType,
    agent_id: matchedAgent.id,
    manager_id: manager?.id || null,
    user_id: userId,
  });

  if (insertError) {
    log.warn("assign agent failed", { message: insertError });
    return;
  }

  // Lock exclusive agent on the email address if not already set
  if (emailAddress && matchedAgent) {
    const addr = emailAddress.toLowerCase().trim();
    const existingRule = await findAddressRuleForUser(addr, userId);

    if (existingRule && !existingRule.exclusive_agent_id) {
      await setAddressRuleExclusiveAgent(existingRule.id, matchedAgent.id);
    } else if (!existingRule) {
      await insertAddressRule({
        email_address: addr,
        exclusive_agent_id: matchedAgent.id,
        category: "auto",
        display_name: null,
      }, userId);
    }
  }
}

import { supabase } from "@/integrations/supabase/client";

/**
 * Auto-assign an agent (and optional manager) to a contact based on country_code.
 * Called silently when contacts enter the cockpit.
 *
 * Priority:
 * 1. Active agent whose territory_codes includes the contact's country_code
 * 2. First active agent with role "sales" or "outreach" (fallback)
 * 3. Skip if no agents exist
 */
export async function autoAssignAgent(params: {
  sourceId: string;
  sourceType: string;
  countryCode: string | null;
  userId: string;
}): Promise<void> {
  const { sourceId, sourceType, countryCode, userId } = params;

  // Check if already assigned
  const { data: existing } = await supabase
    .from("client_assignments" as any)
    .select("id")
    .eq("source_id", sourceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return; // already assigned

  // Fetch all active agents for this user
  const { data: agents } = await supabase
    .from("agents" as any)
    .select("id, role, territory_codes")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (!agents || agents.length === 0) return;

  const typedAgents = agents as unknown as Array<{
    id: string;
    role: string;
    territory_codes: string[] | null;
  }>;

  // 1. Find agent by territory match
  let matchedAgent: typeof typedAgents[0] | null = null;
  if (countryCode) {
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

  // Find manager (first agent with role containing "manager")
  const manager = typedAgents.find(a =>
    a.role?.toLowerCase().includes("manager") && a.id !== matchedAgent!.id
  );

  const { error } = await supabase
    .from("client_assignments" as any)
    .insert({
      source_id: sourceId,
      source_type: sourceType,
      agent_id: matchedAgent.id,
      manager_id: manager?.id || null,
      user_id: userId,
    } as any);

  if (error) {
    console.warn("[AutoAssign] Failed to assign agent:", error.message);
  }
}

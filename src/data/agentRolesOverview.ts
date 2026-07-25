/**
 * DAL — AgentRolesOverviewPage.
 * READ-only. Preserva ESATTAMENTE la semantica del consumer originale
 * (src/v2/ui/pages/AgentRolesOverviewPage.tsx): stessi select/filtri/order,
 * stesso silenziamento errori (`.data ?? []`, nessun throw/log/retry),
 * stesso Promise.all in parallelo.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AgentRolesOverviewRawAgent {
  id: string;
  name: string;
  role: string;
  avatar_emoji: string;
  is_active: boolean;
  can_send_email: boolean | null;
  can_send_whatsapp: boolean | null;
  can_access_inbox: boolean | null;
  assigned_tools: unknown;
}

export interface AgentRolesOverviewRaw {
  agents: AgentRolesOverviewRawAgent[];
  personas: { agent_id: string }[];
  capabilities: { agent_id: string; allowed_tools: unknown; execution_mode: string | null }[];
  autoresponderTemplates: { id: string; enabled: boolean | null }[];
  wakeUpRules: { id: string; is_active: boolean | null }[];
}

export async function fetchAgentRolesOverview(): Promise<AgentRolesOverviewRaw> {
  const [agentsRes, personasRes, capsRes, autoRes, wakeRes] = await Promise.all([
    supabase
      .from("agents")
      .select(
        "id, name, role, avatar_emoji, is_active, can_send_email, can_send_whatsapp, can_access_inbox, assigned_tools",
      )
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("role", { ascending: true }),
    supabase.from("agent_personas").select("agent_id"),
    supabase.from("agent_capabilities").select("agent_id, allowed_tools, execution_mode"),
    supabase.from("funnemail_autoresponder_templates").select("id, enabled"),
    supabase.from("wake_up_rules").select("id, is_active").is("deleted_at", null),
  ]);

  return {
    agents: (agentsRes.data ?? []) as AgentRolesOverviewRawAgent[],
    personas: (personasRes.data ?? []) as { agent_id: string }[],
    capabilities: (capsRes.data ?? []) as {
      agent_id: string;
      allowed_tools: unknown;
      execution_mode: string | null;
    }[],
    autoresponderTemplates: (autoRes.data ?? []) as { id: string; enabled: boolean | null }[],
    wakeUpRules: (wakeRes.data ?? []) as { id: string; is_active: boolean | null }[],
  };
}
/**
 * useAgentCapabilities — data hook for agent capabilities report
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import {
  ALL_OPERATIONAL_TOOLS,
  MANAGEMENT_TOOLS,
  STRATEGIC_TOOLS,
} from "@/data/agentTemplates/roles";

const ALL_TOOLS = [
  ...ALL_OPERATIONAL_TOOLS,
  ...MANAGEMENT_TOOLS,
  ...STRATEGIC_TOOLS,
];

const TOOL_CATEGORIES: Record<string, string[]> = {
  Partner: [
    "search_partners", "get_partner_detail", "update_partner",
    "add_partner_note", "manage_partner_contact", "bulk_update_partners",
  ],
  Network: [
    "get_country_overview", "get_directory_status", "list_jobs",
    "check_job_status", "get_partners_without_contacts",
  ],
  Ricerca: [
    "deep_search_partner", "deep_search_contact",
    "enrich_partner_website", "generate_aliases",
  ],
  CRM: [
    "search_contacts", "get_contact_detail", "update_lead_status",
    "search_prospects",
  ],
  Outreach: [
    "generate_outreach", "send_email", "schedule_email", "queue_outreach",
  ],
  Agenda: [
    "create_activity", "list_activities", "update_activity",
    "create_reminder", "update_reminder", "list_reminders",
  ],
  Sistema: [
    "check_blacklist", "get_global_summary", "save_memory", "search_memory",
    "delete_records", "search_business_cards", "execute_ui_action",
    "get_operations_dashboard",
  ],
  Comunicazione: [
    "get_inbox", "get_conversation_history", "get_holding_pattern",
    "update_message_status", "get_email_thread", "analyze_incoming_email",
  ],
  Management: MANAGEMENT_TOOLS,
  Strategic: STRATEGIC_TOOLS,
};

export interface AgentCapability {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly avatarEmoji: string;
  readonly isActive: boolean;
  readonly assignedTools: string[];
  readonly assignedCount: number;
  readonly totalTools: number;
  readonly coveragePercent: number;
  readonly missingTools: string[];
  readonly missingByCategory: Record<string, string[]>;
  readonly taskUsage: Record<string, number>;
  readonly totalTasks: number;
}

export function useAgentCapabilities() {
  return useQuery({
    queryKey: queryKeys.v2.agents("capabilities"),
    queryFn: async () => {
      const [agentsRes, tasksRes] = await Promise.all([
        supabase.from("agents").select("id, name, role, avatar_emoji, is_active, assigned_tools").order("created_at", { ascending: true }),
        supabase.from("agent_tasks").select("agent_id, task_type, status"),
      ]);

      if (agentsRes.error) throw agentsRes.error;
      if (tasksRes.error) throw tasksRes.error;

      const tasksByAgent = new Map<string, Record<string, number>>();
      for (const t of tasksRes.data ?? []) {
        if (!tasksByAgent.has(t.agent_id)) tasksByAgent.set(t.agent_id, {});
        const map = tasksByAgent.get(t.agent_id)!;
        map[t.task_type] = (map[t.task_type] ?? 0) + 1;
      }

      const agents: AgentCapability[] = (agentsRes.data ?? []).map((a) => {
        const rawTools = a.assigned_tools;
        const assignedTools: string[] = Array.isArray(rawTools) ? (rawTools as string[]) : [];
        const assignedSet = new Set(assignedTools);
        const missingTools = ALL_TOOLS.filter((t) => !assignedSet.has(t));

        const missingByCategory: Record<string, string[]> = {};
        for (const [cat, tools] of Object.entries(TOOL_CATEGORIES)) {
          const missing = tools.filter((t) => !assignedSet.has(t));
          if (missing.length > 0) missingByCategory[cat] = missing;
        }

        const taskUsage = tasksByAgent.get(a.id) ?? {};
        const totalTasks = Object.values(taskUsage).reduce((s, n) => s + n, 0);

        return {
          id: a.id,
          name: a.name,
          role: a.role,
          avatarEmoji: a.avatar_emoji,
          isActive: a.is_active,
          assignedTools,
          assignedCount: assignedTools.length,
          totalTools: ALL_TOOLS.length,
          coveragePercent: ALL_TOOLS.length > 0 ? Math.round((assignedTools.length / ALL_TOOLS.length) * 100) : 0,
          missingTools,
          missingByCategory,
          taskUsage,
          totalTasks,
        };
      });

      return agents;
    },
    staleTime: 60_000,
  });
}

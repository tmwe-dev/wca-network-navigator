import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { findAgentsByUser } from "@/data/agents";
import { findClientAssignmentsByUser } from "@/data/clientAssignments";
import { findAgentTasksByUser } from "@/data/agentTasks";
import { findOperativePrompts } from "@/data/operativePrompts";

export interface DirectoryAgent {
  id: string;
  name: string;
  role: string;
  avatar_emoji: string;
  is_active: boolean;
  stats: { tasks_completed: number; emails_sent: number; calls_made: number };
  clientCount: number;
  activeTaskCount: number;
}

export interface DirectoryPrompt {
  id: string;
  name: string;
  objective: string;
  priority: number;
  tags: string[];
  is_active: boolean;
}

export interface SystemDirectory {
  agents: DirectoryAgent[];
  prompts: DirectoryPrompt[];
  processes: Array<{ name: string; description: string; section: string }>;
}

const SYSTEM_PROCESSES = [
  { name: "Outreach Cockpit", description: "Genera e invia messaggi multicanale (email/WA/LI)", section: "Cockpit" },
  { name: "Circuito di Attesa", description: "Follow-up automatico post-invio con regole per tipo contatto", section: "Cockpit" },
  { name: "Download WCA", description: "Sync profili dalla directory WCA per paese", section: "Network" },
  { name: "Deep Search", description: "Ricerca Google + LinkedIn per arricchimento profili", section: "Ricerca" },
  { name: "Email Sync", description: "Sincronizzazione IMAP bidirezionale", section: "InReach" },
  { name: "WhatsApp Bridge", description: "Lettura messaggi via estensione Chrome", section: "InReach" },
  { name: "Campaign Queue", description: "Invio email in coda con delay anti-spam", section: "Email" },
  { name: "Ciclo Autonomo", description: "Esecuzione periodica task agenti via pg_cron", section: "Agenti" },
];

export function useSystemDirectory() {
  return useQuery({
    queryKey: ["system-directory"],
    queryFn: async (): Promise<SystemDirectory> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Parallel queries
      const [agentsData, assignmentsData, tasksData, promptsData] = await Promise.all([
        findAgentsByUser(user.id, "id, name, role, avatar_emoji, is_active, stats"),
        findClientAssignmentsByUser(user.id),
        findAgentTasksByUser(user.id, ["pending", "running"]),
        findOperativePrompts(user.id),
      ]);
      const agentsRes = { data: agentsData };
      const assignmentsRes = { data: assignmentsData };
      const tasksRes = { data: tasksData };
      const promptsRes = { data: promptsData };

      // Count assignments per agent
      const assignMap = new Map<string, number>();
      if (assignmentsRes.data) {
        for (const a of assignmentsRes.data) assignMap.set(a.agent_id, (assignMap.get(a.agent_id) || 0) + 1);
      }

      // Count active tasks per agent
      const taskMap = new Map<string, number>();
      if (tasksRes.data) {
        for (const t of tasksRes.data) taskMap.set(t.agent_id, (taskMap.get(t.agent_id) || 0) + 1);
      }

      const agents: DirectoryAgent[] = (agentsRes.data || []).map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        avatar_emoji: a.avatar_emoji,
        is_active: a.is_active,
        stats: (a.stats as unknown as DirectoryAgent["stats"]) || { tasks_completed: 0, emails_sent: 0, calls_made: 0 },
        clientCount: assignMap.get(a.id) || 0,
        activeTaskCount: taskMap.get(a.id) || 0,
      }));

      const prompts: DirectoryPrompt[] = (promptsRes.data || []).map((p) => ({
        id: p.id,
        name: p.name,
        objective: p.objective || "",
        priority: p.priority,
        tags: p.tags || [],
        is_active: p.is_active,
      }));

      return { agents, prompts, processes: SYSTEM_PROCESSES };
    },
    staleTime: 60_000,
  });
}

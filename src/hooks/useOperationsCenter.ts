import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";
import { getOpsCenterAgentTasks, getAgentNamesByIds, getOpsCenterEmailQueue, getOpsCenterActivities } from "@/data/opsCenterQueries";
import { queryKeys } from "@/lib/queryKeys";

export interface AgentTaskLive {
  id: string;
  agent_id: string;
  agent_name?: string;
  agent_emoji?: string;
  description: string;
  status: string;
  task_type: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  result_summary: string | null;
}

export interface EmailQueueItem {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  opened_at: string | null;
  open_count: number;
}

export interface ActivityLive {
  id: string;
  title: string;
  activity_type: string;
  status: string;
  scheduled_at: string | null;
  due_date: string | null;
  partner_name?: string;
  email_subject: string | null;
  sent_at: string | null;
  created_at: string;
}

export function useOperationsCenter() {
  const { data: downloadJobs = [] } = useDownloadJobs();

  // Agent tasks (last 50)
  const { data: agentTasks = [], refetch: refetchTasks } = useQuery({
    queryKey: queryKeys.opsCenter.agentTasks(),
    queryFn: async () => {
      const data = await getOpsCenterAgentTasks();

      // Get agent names
      const agentIds = [...new Set((data || []).map((t) => t.agent_id))];
      const agentMap = await getAgentNamesByIds(agentIds);

      return (data || []).map((t) => ({
        ...t,
        agent_name: agentMap[t.agent_id]?.name || "Agente",
        agent_emoji: agentMap[t.agent_id]?.emoji || "🤖",
      })) as AgentTaskLive[];
    },
    staleTime: 10_000,
    // Realtime subscription on agent_tasks (below) handles updates; polling removed.
    refetchInterval: false,
  });

  // Email queue (last 100)
  const { data: emailQueue = [], refetch: refetchEmails } = useQuery({
    queryKey: queryKeys.opsCenter.emailQueue(),
    queryFn: async () => {
      const data = await getOpsCenterEmailQueue();
      return (data || []) as EmailQueueItem[];
    },
    staleTime: 10_000,
    // Realtime subscription on email_campaign_queue (below) handles updates.
    refetchInterval: false,
  });

  // Activities (recent 50, not cancelled)
  const { data: activities = [], refetch: refetchActivities } = useQuery({
    queryKey: queryKeys.opsCenter.activities(),
    queryFn: async () => {
      const data = await getOpsCenterActivities();
      return (data || []).map((a) => ({
        ...a,
        partner_name: a.partners?.company_name || null,
      })) as ActivityLive[];
    },
    staleTime: 10_000,
    // Realtime subscription on activities (below) handles updates.
    refetchInterval: false,
  });

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("ops-center-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_tasks" }, () => refetchTasks())
      .on("postgres_changes", { event: "*", schema: "public", table: "email_campaign_queue" }, () => refetchEmails())
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, () => refetchActivities())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refetchTasks, refetchEmails, refetchActivities]);

  // Stats
  const stats = useMemo(() => {
    const activeDownloads = downloadJobs.filter(j => ["running", "pending"].includes(j.status)).length;
    const completedDownloads = downloadJobs.filter(j => j.status === "completed").length;
    const failedDownloads = downloadJobs.filter(j => j.status === "failed").length;

    const pendingEmails = emailQueue.filter(e => e.status === "pending").length;
    const sentEmails = emailQueue.filter(e => e.status === "sent").length;
    const failedEmails = emailQueue.filter(e => e.status === "failed").length;
    const scheduledEmails = emailQueue.filter(e => e.scheduled_at && e.status === "pending").length;
    const openedEmails = emailQueue.filter(e => (e.open_count || 0) > 0).length;

    const runningTasks = agentTasks.filter(t => ["pending", "running"].includes(t.status)).length;
    const completedTasks = agentTasks.filter(t => t.status === "completed").length;

    const pendingActivities = activities.filter(a => a.status === "pending").length;
    const scheduledActivities = activities.filter(a => a.scheduled_at).length;

    return {
      activeDownloads, completedDownloads, failedDownloads,
      pendingEmails, sentEmails, failedEmails, scheduledEmails, openedEmails,
      runningTasks, completedTasks,
      pendingActivities, scheduledActivities,
    };
  }, [downloadJobs, emailQueue, agentTasks, activities]);

  return {
    downloadJobs,
    agentTasks,
    emailQueue,
    activities,
    stats,
  };
}

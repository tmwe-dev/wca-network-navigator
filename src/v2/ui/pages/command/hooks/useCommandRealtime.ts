/**
 * useCommandRealtime — Subscribe to Supabase Realtime for the Command page.
 *
 * Listens to:
 *   - download_jobs        (status / progress changes)
 *   - outreach_queue       (sent / failed)
 *   - agent_action_log     (every AI tool execution)
 *   - mission_actions      (mission step transitions)
 *   - campaign_jobs        (campaign worker progress)
 *
 * Pattern: async-hook-resilience
 *   - subscribed once on mount, cleaned up on unmount
 *   - mountedRef guards setState after unmount
 *   - filter by current user_id (no cross-tenant data)
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LiveActivity {
  id: string;
  /** kind drives icon + color */
  kind: "outreach" | "scrape" | "agent" | "mission" | "campaign";
  label: string;
  detail?: string;
  status: "running" | "success" | "warning" | "error";
  ts: number;
}

export interface RealtimeSnapshot {
  activities: LiveActivity[];
  /** counters used for auto-refresh signaling */
  outreachUpdates: number;
  jobUpdates: number;
}

const MAX_ACTIVITIES = 12;

function pushActivity(prev: LiveActivity[], a: LiveActivity): LiveActivity[] {
  const next = [a, ...prev.filter((x) => x.id !== a.id)].slice(0, MAX_ACTIVITIES);
  return next;
}

export function useCommandRealtime(): RealtimeSnapshot {
  const [activities, setActivities] = useState<LiveActivity[]>([]);
  const [outreachUpdates, setOutreachUpdates] = useState(0);
  const [jobUpdates, setJobUpdates] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let userId: string | null = null;

    const setup = async () => {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
      if (!userId || !mountedRef.current) return;

      const channel = supabase
        .channel("command_live")
        // download_jobs
        .on("postgres_changes", { event: "*", schema: "public", table: "download_jobs", filter: `user_id=eq.${userId}` }, (payload) => {
          if (!mountedRef.current) return;
          const row = (payload.new ?? payload.old) as Record<string, unknown>;
          const status = String(row?.status ?? "running");
          setActivities((prev) => pushActivity(prev, {
            id: `dj-${String(row?.id ?? "")}`,
            kind: "scrape",
            label: `Download · ${String(row?.country_code ?? row?.target ?? "")}`,
            detail: `${status}${row?.progress ? ` · ${row.progress}%` : ""}`,
            status: status === "completed" ? "success" : status === "failed" ? "error" : "running",
            ts: Date.now(),
          }));
          setJobUpdates((n) => n + 1);
        })
        // outreach_queue
        .on("postgres_changes", { event: "*", schema: "public", table: "outreach_queue", filter: `user_id=eq.${userId}` }, (payload) => {
          if (!mountedRef.current) return;
          const row = (payload.new ?? payload.old) as Record<string, unknown>;
          const status = String(row?.status ?? "");
          if (!["sent", "failed", "delivered", "replied"].includes(status)) return;
          setActivities((prev) => pushActivity(prev, {
            id: `oq-${String(row?.id ?? "")}`,
            kind: "outreach",
            label: `Outreach · ${String(row?.recipient_email ?? "")}`.slice(0, 44),
            detail: status,
            status: status === "sent" || status === "delivered" ? "success" : status === "replied" ? "success" : "error",
            ts: Date.now(),
          }));
          setOutreachUpdates((n) => n + 1);
        })
        // agent_action_log (insert only — every tool call)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_action_log", filter: `user_id=eq.${userId}` }, (payload) => {
          if (!mountedRef.current) return;
          const row = payload.new as Record<string, unknown>;
          setActivities((prev) => pushActivity(prev, {
            id: `aa-${String(row?.id ?? "")}`,
            kind: "agent",
            label: `Agent · ${String(row?.tool_name ?? "tool")}`,
            detail: "eseguito",
            status: "success",
            ts: Date.now(),
          }));
        })
        // mission_actions
        .on("postgres_changes", { event: "*", schema: "public", table: "mission_actions", filter: `user_id=eq.${userId}` }, (payload) => {
          if (!mountedRef.current) return;
          const row = (payload.new ?? payload.old) as Record<string, unknown>;
          const status = String(row?.status ?? "");
          setActivities((prev) => pushActivity(prev, {
            id: `ma-${String(row?.id ?? "")}`,
            kind: "mission",
            label: `Mission step · ${String(row?.action_type ?? "")}`,
            detail: status,
            status: status === "completed" ? "success" : status === "failed" ? "error" : "running",
            ts: Date.now(),
          }));
        })
        // campaign_jobs
        .on("postgres_changes", { event: "*", schema: "public", table: "campaign_jobs", filter: `user_id=eq.${userId}` }, (payload) => {
          if (!mountedRef.current) return;
          const row = (payload.new ?? payload.old) as Record<string, unknown>;
          const status = String(row?.status ?? "");
          setActivities((prev) => pushActivity(prev, {
            id: `cj-${String(row?.id ?? "")}`,
            kind: "campaign",
            label: `Campagna · ${String(row?.company_name ?? "")}`.slice(0, 44),
            detail: status,
            status: status === "completed" ? "success" : status === "failed" ? "error" : "running",
            ts: Date.now(),
          }));
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanupPromise = setup();
    return () => {
      mountedRef.current = false;
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, []);

  return { activities, outreachUpdates, jobUpdates };
}

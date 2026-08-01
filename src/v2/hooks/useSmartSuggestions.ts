/**
 * useSmartSuggestions — Data-driven action suggestions based on real system state
 */
import { useQuery } from "@tanstack/react-query";
import { fetchSmartSuggestionCounts } from "@/data/smartSuggestionCounts";

export interface SmartSuggestion {
  readonly id: string;
  readonly icon: string;
  readonly label: string;
  readonly description: string;
  readonly route: string;
  readonly count: number;
  readonly priority: number;
}

export function useSmartSuggestions() {
  return useQuery({
    queryKey: ["v2", "smart-suggestions"],
    queryFn: async () => {
      const suggestions: SmartSuggestion[] = [];

      const counts = await fetchSmartSuggestionCounts();

      const unread = counts.unreadInboundMessages;
      if (unread > 0) {
        suggestions.push({
          id: "unread-emails",
          icon: "📨",
          label: `${unread} email da leggere`,
          description: "Analizza e classifica le email in arrivo",
          route: "/v2/cockpit",
          count: unread,
          priority: 100,
        });
      }

      const proposed = counts.pendingTasks;
      if (proposed > 0) {
        suggestions.push({
          id: "proposed-tasks",
          icon: "🤖",
          label: `${proposed} task agente da confermare`,
          description: "Approva o modifica i task proposti dagli agenti",
          route: "/v2/agents/tasks",
          count: proposed,
          priority: 95,
        });
      }

      const approval = counts.pendingApproval;
      if (approval > 0) {
        suggestions.push({
          id: "pending-approval",
          icon: "✅",
          label: `${approval} azioni da autorizzare`,
          description: "Approva le azioni programmate dalle missioni",
          route: "/v2/cockpit",
          count: approval,
          priority: 90,
        });
      }

      const drafts = counts.draftEmails;
      if (drafts > 0) {
        suggestions.push({
          id: "draft-emails",
          icon: "✏️",
          label: `${drafts} bozze email da rivedere`,
          description: "Rivedi e invia le email in bozza",
          route: "/v2/cockpit",
          count: drafts,
          priority: 85,
        });
      }

      const pending = counts.pendingOutreach;
      if (pending > 0) {
        suggestions.push({
          id: "pending-outreach",
          icon: "📤",
          label: `${pending} outreach programmati`,
          description: "Verifica le comunicazioni in coda",
          route: "/v2/cockpit",
          count: pending,
          priority: 80,
        });
      }

      const jobs = counts.activeJobs;
      if (jobs > 0) {
        suggestions.push({
          id: "active-jobs",
          icon: "⚙️",
          label: `${jobs} job attivi`,
          description: "Monitora i download e le operazioni in corso",
          route: "/v2/network",
          count: jobs,
          priority: 70,
        });
      }

      // Always add a fallback suggestion
      if (suggestions.length === 0) {
        suggestions.push({
          id: "explore",
          icon: "🔍",
          label: "Esplora il network",
          description: "Naviga i partner WCA e i contatti",
          route: "/v2/network",
          count: 0,
          priority: 10,
        });
      }

      return suggestions.sort((a, b) => b.priority - a.priority).slice(0, 5);
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

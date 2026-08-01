import { fetchAgents } from "@/v2/io/supabase/queries/agents";
import { fetchActivities } from "@/v2/io/supabase/queries/activities";
import type { Tool, ToolResult } from "./types";

function activityStatusToTimeline(status: string): "success" | "pending" | "warning" | "info" {
  switch (status) {
    case "completed": return "success";
    case "pending": return "pending";
    case "cancelled": return "warning";
    default: return "info";
  }
}

export const agentReportTool: Tool = {
  id: "agent-report",
  label: "Report agenti settimana",
  description: "Aggrega attività degli agenti negli ultimi 7 giorni",

  match(prompt: string): boolean {
    const p = prompt.toLowerCase();
    return /agent[ie]?.*(report|settiman|perform|attivit|riepilog)/.test(p)
      || /(report|perform|riepilog).*agent/.test(p);
  },

  async execute(): Promise<ToolResult> {
    const agentsRes = await fetchAgents();
    if (agentsRes._tag === "Err") throw new Error(agentsRes.error.message ?? "Errore lettura agenti");

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const actsRes = await fetchActivities({ since, limit: 200 });
    if (actsRes._tag === "Err") throw new Error(actsRes.error.message ?? "Errore lettura attività");

    const agents = agentsRes.value;
    const activities = actsRes.value;

    const events = activities
      .map((a) => {
        const agent = agents.find((ag) => ag.id === a.executedByAgentId);
        const d = new Date(a.createdAt);
        const time = `${d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
        return {
          time,
          agent: agent?.name ?? "Manuale",
          action: a.title,
          status: activityStatusToTimeline(a.status),
        };
      })
      .sort((x, y) => activities.indexOf(x as never) - activities.indexOf(y as never));

    const activeAgents = new Set(
      activities.map((a) => a.executedByAgentId).filter(Boolean),
    ).size;

    const kpis = [
      { label: "Attività totali", value: String(activities.length) },
      { label: "Agenti attivi", value: String(activeAgents) },
      { label: "Media/giorno", value: String(Math.round((activities.length / 7) * 10) / 10) },
    ];

    return {
      kind: "timeline",
      title: "Report agenti · ultimi 7 giorni",
      meta: { count: activities.length, sourceLabel: "Supabase · activities + agents" },
      kpis,
      events,
    };
  },
};

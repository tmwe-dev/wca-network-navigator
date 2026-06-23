/**
 * Tool: list-missions — Read-only overview of autopilot missions with KPI/budget progress.
 */
import { untypedFrom } from "@/lib/supabaseUntyped";
import type { Tool, ToolResult } from "./types";

interface MissionRow {
  id: string;
  title: string | null;
  goal_type: string | null;
  status: string | null;
  autopilot: boolean | null;
  kpi_target: number | null;
  kpi_current: number | null;
  budget: number | null;
  budget_consumed: number | null;
}

export const listMissionsTool: Tool = {
  id: "list-missions",
  label: "Missioni",
  description: "Elenca le missioni autopilot configurate con stato, avanzamento KPI e budget consumato.",
  match: (p) =>
    /\b(missioni|elenco\s+mission|lista\s+mission|stato\s+(delle\s+)?mission|autopilot|quante\s+mission)\b/i.test(p) &&
    !/\b(avvia|esegui|lancia|fai\s+partire|trigger|ferma|pausa|stoppa)\b/i.test(p),

  execute: async (): Promise<ToolResult> => {
    const { data, error, count } = await untypedFrom("agent_missions")
      .select(
        "id,title,goal_type,status,autopilot,kpi_target,kpi_current,budget,budget_consumed",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) {
      return {
        kind: "result",
        title: "Missioni non disponibili",
        message: `Impossibile leggere le missioni: ${error.message}`,
        status: "error",
        meta: { count: 0, sourceLabel: "DB · agent_missions" },
      };
    }

    const rows = (data ?? []) as MissionRow[];
    if (rows.length === 0) {
      return {
        kind: "result",
        title: "Nessuna missione",
        message: "Non ci sono missioni autopilot configurate.",
        status: "empty",
        meta: { count: 0, sourceLabel: "DB · agent_missions" },
      };
    }

    return {
      kind: "table",
      title: "Missioni autopilot",
      meta: { count: count ?? rows.length, sourceLabel: "DB · agent_missions" },
      columns: [
        { key: "title", label: "Missione" },
        { key: "status", label: "Stato" },
        { key: "autopilot", label: "Autopilot" },
        { key: "kpi", label: "KPI" },
        { key: "budget", label: "Budget" },
      ],
      rows: rows.map((r) => ({
        id: r.id,
        title: r.title ?? "—",
        status: r.status ?? "—",
        autopilot: r.autopilot ? "on" : "off",
        kpi: `${r.kpi_current ?? 0} / ${r.kpi_target ?? "—"}`,
        budget: `${r.budget_consumed ?? 0} / ${r.budget ?? "—"}`,
      })),
      idField: "id",
      liveSource: "agent_missions",
    };
  },
};
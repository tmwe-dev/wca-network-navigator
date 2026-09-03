/**
 * Tool: dashboard-snapshot — Quick dashboard counts
 */
import { fetchDashboardCounts } from "@/v2/io/supabase/queries/dashboard";
import { isOk } from "@/v2/core/domain/result";
import type { Tool, ToolResult } from "./types";

export const dashboardSnapshotTool: Tool = {
  id: "dashboard-snapshot",
  label: "Panoramica sistema",
  description: "Mostra un riepilogo del sistema: partner, contatti, attività, agenti, campagne",
  // "stato del sistema" appartiene alla diagnostica (health-check) quando
  // il prompt cita esplicitamente health/diagnosi: qui restiamo sui numeri.
  match: (p) =>
    !/health\s*check|diagnos(?:i|tica)/i.test(p) && /dashboard|panoramica|riepilogo|stato (del )?sistema/i.test(p),

  execute: async (): Promise<ToolResult> => {
    const result = await fetchDashboardCounts();

    if (!isOk(result)) {
      return {
        kind: "result",
        title: "Panoramica sistema non disponibile",
        message: `Impossibile leggere i conteggi di sistema: ${result.error.message ?? "errore sconosciuto"}`,
        status: "error",
        meta: { count: 0, sourceLabel: "Dati live del tuo sistema" },
      };
    }

    const c = result.value;
    const total = c.partners + c.contacts + c.pendingActivities + c.activeAgents + c.campaignJobs + c.emailDrafts;

    if (total === 0) {
      return {
        kind: "result",
        title: "Panoramica sistema vuota",
        message: "Nessun dato presente: partner, contatti, attività, agenti e campagne sono tutti a zero.",
        status: "empty",
        meta: { count: 0, sourceLabel: "Dati live del tuo sistema" },
      };
    }

    return {
      kind: "table",
      title: "Dashboard · Snapshot",
      meta: { count: 6, sourceLabel: "Dati live del tuo sistema" },
      columns: [
        { key: "metric", label: "Metrica" },
        { key: "value", label: "Valore" },
      ],
      rows: [
        { metric: "Partner WCA", value: c.partners },
        { metric: "Contatti", value: c.contacts },
        { metric: "Attività pending", value: c.pendingActivities },
        { metric: "Agenti attivi", value: c.activeAgents },
        { metric: "Job campagne", value: c.campaignJobs },
        { metric: "Bozze email", value: c.emailDrafts },
      ],
    };
  },
};

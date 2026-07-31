/**
 * Tool: list-agenda — Read-only daily agenda: open activities ordered by due date.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tool, ToolResult } from "./types";

interface ActivityRow {
  id: string;
  title: string | null;
  description: string | null;
  due_date: string | null;
  status: string | null;
  priority: string | null;
}

export const listAgendaTool: Tool = {
  id: "list-agenda",
  label: "Agenda",
  description: "Mostra l'agenda operativa: attività aperte ordinate per scadenza (cosa fare oggi e nei prossimi giorni).",
  match: (p) =>
    /\b(agenda|cosa\s+devo\s+fare|cosa\s+ho\s+da\s+fare|attivit[àa]\s+(di\s+)?oggi|scadenz|to-?do|task\s+(di\s+)?oggi|impegni)\b/i.test(p),

  execute: async (): Promise<ToolResult> => {
    const { data, error, count } = await supabase.from("activities")
      .select("id,title,description,due_date,status,priority", { count: "exact" })
      .is("deleted_at", null)
      .neq("status", "completed")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(40);

    if (error) {
      return {
        kind: "result",
        title: "Agenda non disponibile",
        message: `Impossibile leggere l'agenda: ${error.message}`,
        status: "error",
        meta: { count: 0, sourceLabel: "DB · activities" },
      };
    }

    const rows = (data ?? []) as ActivityRow[];
    if (rows.length === 0) {
      return {
        kind: "result",
        title: "Agenda libera",
        message: "Non ci sono attività aperte in agenda.",
        status: "empty",
        meta: { count: 0, sourceLabel: "DB · activities" },
      };
    }

    return {
      kind: "table",
      title: "Agenda · attività aperte",
      meta: { count: count ?? rows.length, sourceLabel: "DB · activities" },
      columns: [
        { key: "title", label: "Attività" },
        { key: "due", label: "Scadenza" },
        { key: "priority", label: "Priorità" },
        { key: "status", label: "Stato" },
      ],
      rows: rows.map((r) => ({
        id: r.id,
        title: r.title ?? r.description ?? "—",
        due: (r.due_date ?? "").slice(0, 16).replace("T", " ") || "—",
        priority: r.priority ?? "—",
        status: r.status ?? "—",
      })),
      selectable: true,
      idField: "id",
      liveSource: "activities",
      bulkActions: [
        { id: "complete", label: "Segna completate", promptTemplate: "Segna come completate le attività con id: {ids}" },
      ],
    };
  },
};
/**
 * Tool: calculate-lead-scores — Bulk recalculation (requires approval)
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tool, ToolResult, ToolContext } from "./types";

export const calculateLeadScoresTool: Tool = {
  id: "calculate-lead-scores",
  label: "Ricalcola lead score",
  description: "Ricalcola massivamente i punteggi di tutti i lead nel database",
  match: (p) => /(calcola|ricalcola|aggiorna).*score/i.test(p),

  execute: async (_prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Ricalcolare tutti i lead score?",
        description: "Questa operazione ricalcolerà il punteggio di TUTTI i lead nel database. Può richiedere tempo.",
        details: [
          { label: "Azione", value: "Ricalcolo massivo lead scores" },
          { label: "Impatto", value: "Tutti i contatti" },
          { label: "Tipo", value: "Operazione batch" },
        ],
        governance: { role: "ADMIN", permission: "EXECUTE:SCORING", policy: "POLICY v1.0 · SOFT-SYNC" },
        pendingPayload: {},
        toolId: "calculate-lead-scores",
      };
    }

    const { data, error } = await supabase.functions.invoke("calculate-lead-scores", {
      body: {},
    });

    if (error) throw new Error(error.message);

    return {
      kind: "result",
      title: "Lead score ricalcolati",
      message: `Ricalcolo completato. ${data?.updated ?? 0} contatti aggiornati.`,
      meta: { count: data?.updated ?? 0, sourceLabel: "Edge · calculate-lead-scores" },
    };
  },
};

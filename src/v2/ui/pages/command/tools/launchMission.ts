/**
 * Tool: launch-mission — Triggers an existing autopilot mission via mission-executor.
 * Write tool → requires approval. Backed by edge function `mission-executor`.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractMissionRef(prompt: string): string | null {
  const uuid = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuid) return uuid[0];
  const named = prompt.match(/missione\s+["“”']?([^"“”'\n]{3,80})["“”']?/i);
  return named ? named[1].trim() : null;
}

export const launchMissionTool: Tool = {
  id: "launch-mission",
  label: "Avvia missione",
  description: "Esegue una missione autopilot già configurata (richiede mission_id o nome esatto).",
  match: (p) => /\b(avvia|esegui|lancia|fai\s+partire|trigger)\b[^.]{0,30}\b(missione|mission|autopilot)\b/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      const ref = extractMissionRef(prompt);
      let missionId: string | null = null;
      let missionName: string | null = null;
      if (ref) {
        if (/^[0-9a-f-]{36}$/i.test(ref)) {
          missionId = ref;
          const { data } = await untypedFrom("agent_missions").select("name").eq("id", ref).maybeSingle();
          missionName = (data as { name?: string } | null)?.name ?? null;
        } else {
          const { data } = await untypedFrom("agent_missions").select("id, name").ilike("name", `%${ref}%`).limit(1).maybeSingle();
          if (data) {
            const row = data as { id: string; name: string };
            missionId = row.id;
            missionName = row.name;
          }
        }
      }
      return {
        kind: "approval",
        title: "Avviare missione autopilot?",
        description: "La missione verrà eseguita un round dal mission-executor (rispetta slot e finestra oraria).",
        details: [
          { label: "Missione", value: missionName ?? ref ?? "(non identificata)" },
          { label: "Mission ID", value: missionId ?? "—" },
        ],
        governance: { role: "DIRETTORE", permission: "EXECUTE:MISSIONS", policy: "POLICY v1.0 · AUTOPILOT-KPI" },
        pendingPayload: { mission_id: missionId, mission_name: missionName ?? ref },
        toolId: "launch-mission",
      };
    }

    const p = context.payload ?? {};
    if (!p.mission_id) {
      return {
        kind: "result",
        title: "Missione non identificata",
        message: `Non ho trovato una missione corrispondente a "${String(p.mission_name ?? "")}". Specifica il mission_id o il nome esatto.`,
        meta: { count: 0, sourceLabel: "DB · missions" },
      };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        kind: "result",
        title: "Sessione non valida",
        message: "Riautentica e riprova.",
        meta: { count: 0, sourceLabel: "auth" },
      };
    }

    const res = await invokeEdge<{ status?: string; message?: string; progress?: unknown; error?: string }>(
      "mission-executor",
      {
        body: { mission_id: String(p.mission_id), user_id: user.id },
        context: "command:launch-mission",
      },
    );

    return {
      kind: "result",
      title: res?.error ? "Missione non avviata" : `Missione: ${res?.status ?? "ok"}`,
      message: res?.error ?? res?.message ?? "Round eseguito.",
      meta: { count: 1, sourceLabel: "Edge · mission-executor" },
    };
  },
};
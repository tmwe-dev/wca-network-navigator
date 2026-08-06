/**
 * Tool: mission-control — Pause / resume / stop an autopilot mission (requires approval).
 * Write tool: updates agent_missions.status. Does NOT run mission rounds (that's launch-mission).
 */
import { findAgentMissionTitleById, findAgentMissionByTitleLike, updateAgentMissionFields } from "@/data/agentMissions";
import type { Tool, ToolResult, ToolContext } from "./types";

type MissionAction = "paused" | "active" | "cancelled";

function detectAction(prompt: string): MissionAction | null {
  if (/\b(pausa|sospend|metti\s+in\s+pausa|pause)\b/i.test(prompt)) return "paused";
  if (/\b(riprend|riattiv|riavvi|resume|sblocca)\b/i.test(prompt)) return "active";
  if (/\b(ferma|stoppa|stop|interrompi|annulla|cancella|chiudi)\b/i.test(prompt)) return "cancelled";
  return null;
}

function extractMissionRef(prompt: string): string | null {
  const uuid = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuid) return uuid[0];
  const named = prompt.match(/missione\s+["“”']?([^"“”'\n]{3,80})["“”']?/i);
  return named ? named[1].trim() : null;
}

const ACTION_LABEL: Record<MissionAction, string> = {
  paused: "Sospensione",
  active: "Riattivazione",
  cancelled: "Interruzione",
};

export const missionControlTool: Tool = {
  id: "mission-control",
  label: "Controllo missione",
  description: "Mette in pausa, riattiva o ferma una missione autopilot (cambia lo stato, non esegue round).",
  match: (p) =>
    /\b(missione|mission|autopilot)\b/i.test(p) &&
    /\b(pausa|sospend|riprend|riattiv|riavvi|ferma|stoppa|stop|interrompi|annulla|sblocca)\b/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      const action = detectAction(prompt);
      const ref = extractMissionRef(prompt);
      let missionId: string | null = null;
      let missionName: string | null = ref;
      if (ref && /^[0-9a-f-]{36}$/i.test(ref)) {
        missionId = ref;
        const data = await findAgentMissionTitleById(ref);
        missionName = data?.title ?? ref;
      } else if (ref) {
        const row = await findAgentMissionByTitleLike(ref);
        if (row) {
          missionId = row.id;
          missionName = row.title;
        }
      }
      return {
        kind: "approval",
        title: action ? `${ACTION_LABEL[action]} missione?` : "Controllo missione?",
        description: "Lo stato della missione autopilot verrà aggiornato. I round già pianificati seguiranno il nuovo stato.",
        details: [
          { label: "Missione", value: missionName ?? "(non identificata)" },
          { label: "Mission ID", value: missionId ?? "—" },
          { label: "Nuovo stato", value: action ?? "(da specificare)" },
        ],
        governance: { role: "DIRETTORE", permission: "WRITE:MISSIONS", policy: "POLICY v1.0 · AUTOPILOT-KPI" },
        pendingPayload: { mission_id: missionId, mission_name: missionName, action },
        toolId: "mission-control",
      };
    }

    const p = context.payload ?? {};
    const missionId = String(p.mission_id ?? "");
    const action = p.action as MissionAction | null;
    if (!missionId) {
      return {
        kind: "result",
        title: "Missione non identificata",
        message: `Non ho trovato una missione corrispondente a "${String(p.mission_name ?? "")}". Specifica il mission_id o il nome esatto.`,
        status: "error",
        meta: { count: 0, sourceLabel: "DB · agent_missions" },
      };
    }
    if (!action) {
      return {
        kind: "result",
        title: "Azione non chiara",
        message: "Specifica se vuoi mettere in pausa, riattivare o fermare la missione.",
        status: "unsupported",
        meta: { count: 0, sourceLabel: "DB · agent_missions" },
      };
    }

    try {
      await updateAgentMissionFields(missionId, { status: action });
    } catch (e) {
      const error = e as { message: string };
      return {
        kind: "result",
        title: "Controllo missione fallito",
        message: error.message,
        status: "error",
        meta: { count: 0, sourceLabel: "DB · agent_missions" },
      };
    }

    return {
      kind: "result",
      title: `Missione: ${action}`,
      message: `Stato missione aggiornato a "${action}".`,
      status: "ok",
      meta: { count: 1, sourceLabel: "DB · agent_missions" },
    };
  },
};

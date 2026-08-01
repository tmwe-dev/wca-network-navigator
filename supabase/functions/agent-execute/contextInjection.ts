// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONTEXT INJECTION - User Settings, Memory, KB, Team Data
// Le singole sezioni vivono in `contextSections.ts` (stesso comportamento,
// stesso ordine di append, stesso accumulatore di findings).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { summarizeFindings, type SanitizeFinding } from "../_shared/promptSanitizer.ts";
import {
  appendUserSettingsSection,
  appendMemoryAndKbSection,
  appendTeamSection,
  appendMyClientsSection,
  appendTeamTasksAndMissionsSection,
  appendDirectorViewSection,
  type AgentExecuteSupabaseClient,
  type AgentRow,
  type ContextAccumulator,
  type DecisionLogRow,
  type AgentMissionRow,
} from "./contextSections.ts";

const asArray = <T>(data: T[] | null | undefined): T[] => data ?? [];
const asMaybe = <T>(data: T | null | undefined): T | null => data ?? null;

/**
 * Build comprehensive context block with user profile, memory, KB, team status
 */
export async function buildContextBlock(
  supabase: AgentExecuteSupabaseClient,
  userId: string,
  agentId: string,
  allAgents: AgentRow[] | null
): Promise<string> {
  // Accumulatore di pattern di prompt-injection trovati nei contenuti non-trusted.
  // Logato a fine funzione per audit (vedi summarizeFindings).
  const ctx: ContextAccumulator = { text: "", findings: [] };

  try {
    await appendUserSettingsSection(supabase, ctx, userId, agentId, allAgents);
    await appendMemoryAndKbSection(supabase, ctx, userId, agentId, allAgents);
    await appendTeamSection(supabase, ctx, userId, agentId, allAgents);
    await appendMyClientsSection(supabase, ctx, userId, agentId, allAgents);
    await appendTeamTasksAndMissionsSection(supabase, ctx, userId, agentId, allAgents);
    await appendDirectorViewSection(supabase, ctx, userId, agentId, allAgents);
  } catch (e) {
    console.error("Context injection error:", e);
  }

  // Audit log dei pattern di prompt-injection trovati nei contenuti non-trusted
  // (memoria, KB, email inbound). NON blocca mai il flusso: il sanitizer ha già
  // applicato la policy "redact" sui pattern high/medium.
  if (ctx.findings.length > 0) {
    const summary = summarizeFindings(ctx.findings satisfies SanitizeFinding[]);
    console.warn(JSON.stringify({
      level: "warn",
      event: "prompt_injection_detected",
      fn: "agent-execute/contextInjection",
      userId,
      agentId,
      ...summary,
    }));
  }

  return ctx.text;
}


/**
 * Build learning block from past decisions and corrections
 */
export async function buildLearningBlock(
  supabase: AgentExecuteSupabaseClient,
  agentId: string
): Promise<string> {
  let learningBlock = "";
  try {
    const { data: decisionsData } = await supabase
      .from("ai_decision_log")
      .select("decision_type, input_context, decision_output, user_correction, created_at")
      .eq("operator_id", agentId)
      .order("created_at", { ascending: false })
      .limit(10);
    const decisions = asArray(decisionsData as DecisionLogRow[] | null);
    if (decisions.length) {
      learningBlock += "\n\n--- APPRENDIMENTO DA DECISIONI PASSATE ---\n";
      for (const d of decisions) {
        const date = new Date(d.created_at || new Date().toISOString()).toLocaleDateString("it-IT");
        learningBlock += `[${date}] ${d.decision_type}: `;
        if (d.user_correction) {
          learningBlock += `⚠️ CORRETTO: "${d.user_correction}" (originale: ${JSON.stringify(d.input_context).substring(0, 150)})\n`;
        } else if (d.decision_output) {
          learningBlock += `✅ ${typeof d.decision_output === "string" ? d.decision_output : JSON.stringify(d.decision_output).substring(0, 200)}\n`;
        } else {
          learningBlock += `${JSON.stringify(d.input_context).substring(0, 200)}\n`;
        }
      }
      learningBlock += "IMPORTANTE: Evita di ripetere errori corretti dall'utente. Adatta il tuo approccio in base ai feedback.\n";
    }
  } catch {
    /* ai_decision_log may not exist */
  }
  return learningBlock;
}

/**
 * Build mission context if running within a mission
 */
export async function buildMissionBlock(
  supabase: AgentExecuteSupabaseClient,
  missionId: string | undefined
): Promise<string> {
  let missionBlock = "";
  try {
    if (missionId) {
      const { data } = await supabase
        .from("agent_missions")
        .select("title, goal_description, goal_type, kpi_target, kpi_current, budget, budget_consumed, approval_only_for")
        .eq("id", missionId)
        .maybeSingle();
      const mission = asMaybe(data as AgentMissionRow | null);
      if (mission) {
        const kpiTarget = mission.kpi_target || {};
        const kpiCurrent = mission.kpi_current || {};
        const approvalFor = mission.approval_only_for || [];
        missionBlock += `\n\n--- MISSIONE ATTIVA ---\n`;
        missionBlock += `Titolo: ${mission.title}\n`;
        missionBlock += `Obiettivo: ${mission.goal_description || ""}\n`;
        missionBlock += `KPI Target: ${JSON.stringify(kpiTarget)}\n`;
        missionBlock += `KPI Attuale: ${JSON.stringify(kpiCurrent)}\n`;
        missionBlock += `Budget: ${JSON.stringify(mission.budget_consumed)}/${JSON.stringify(mission.budget)} azioni\n`;
        if (approvalFor.length) {
          missionBlock += `⚠️ RICHIEDI APPROVAZIONE per: ${approvalFor.join(", ")} — usa ai_pending_actions con status 'pending'\n`;
        }
      }
    }
  } catch {
    /* mission may not exist */
  }
  return missionBlock;
}

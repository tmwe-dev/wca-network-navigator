/**
 * harmonizeExecutor — esegue le proposte approvate.
 *
 * Vincoli:
 *  - MAI hard delete: solo soft delete (is_active=false) dove supportato.
 *  - MAI delete su agents/agent_personas.
 *  - resolution_layer in ("contract", "code_policy") → SKIP (read-only).
 *  - Audit log per ogni azione tramite logSupervisorAudit.
 */
import { upsertKbEntry, deleteKbEntry } from "@/data/kbEntries";
import { updateOperativePrompt } from "@/data/operativePrompts";
import { updateEmailPrompt } from "@/data/emailPrompts";
import { updateEmailAddressRule } from "@/data/emailAddressRules";
import { updateCommercialPlaybook } from "@/data/commercialPlaybooks";
import { updateAgentPersona } from "@/data/agentPersonas";
import { createAgent, updateAgent, type AgentInsert, type AgentUpdate } from "@/data/agents";
import { upsertAppSetting } from "@/data/appSettings";
import { createHarmonizerFollowup, followupFromProposal } from "@/data/harmonizerFollowups";
import { logSupervisorAudit } from "@/data/supervisorAuditLog";
import type { HarmonizeProposal } from "@/data/harmonizeRuns";

export interface ExecuteResult {
  ok: boolean;
  reason?: string;
  followup_id?: string;
}

/** Esegue una singola proposta. Ritorna esito (no throw). */
export async function executeProposal(
  userId: string,
  p: HarmonizeProposal,
  runId?: string,
): Promise<ExecuteResult> {
  // 1. Read-only → registra come followup sviluppatore (se runId noto) e termina.
  if (p.resolution_layer === "contract" || p.resolution_layer === "code_policy") {
    let followupId: string | undefined;
    if (runId) {
      const followup = followupFromProposal(runId, userId, p);
      if (followup) {
        try {
          followupId = await createHarmonizerFollowup(followup);
        } catch (e) {
          console.warn("[harmonizeExecutor] followup creation failed", e);
        }
      }
    }
    return {
      ok: false,
      reason: "Proposta read-only: registrata come follow-up sviluppatore.",
      followup_id: followupId,
    };
  }

  // 2. Vincolo: niente delete su agents/agent_personas
  if (p.action === "DELETE" && (p.target.table === "agents" || p.target.table === "agent_personas")) {
    return { ok: false, reason: `DELETE non consentito su ${p.target.table}.` };
  }

  try {
    switch (p.target.table) {
      case "kb_entries":
        return await execKbEntry(userId, p);
      case "operative_prompts":
        return await execOperativePrompt(p);
      case "email_prompts":
        return await execEmailPrompt(p);
      case "email_address_rules":
        return await execEmailAddressRule(p);
      case "commercial_playbooks":
        return await execPlaybook(p);
      case "agent_personas":
        return await execAgentPersona(p);
      case "agents":
        return await execAgent(userId, p);
      case "app_settings":
        return await execAppSetting(userId, p);
      default:
        return { ok: false, reason: `Tabella sconosciuta: ${p.target.table}.` };
    }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  } finally {
    try {
      await logSupervisorAudit({
        actor_id: userId,
        action: `harmonize_${p.action.toLowerCase()}`,
        target_table: p.target.table,
        target_id: p.target.id ?? undefined,
        payload: {
          before: p.before,
          after: p.after,
          payload: p.payload,
          layer: p.resolution_layer,
          reasoning: p.reasoning,
        },
      });
    } catch { /* audit errors don't block exec */ }
  }
}

async function execKbEntry(userId: string, p: HarmonizeProposal): Promise<ExecuteResult> {
  switch (p.action) {
    case "INSERT": {
      const payload = (p.payload ?? {}) as Record<string, unknown>;
      await upsertKbEntry({
        title: String(payload.title ?? p.block_label ?? "Senza titolo"),
        content: p.after ?? "",
        category: String(payload.category ?? "doctrine"),
        chapter: String(payload.chapter ?? "general"),
        tags: Array.isArray(payload.tags) ? (payload.tags as string[]) : [],
        priority: typeof payload.priority === "number" ? (payload.priority as number) : 50,
        sort_order: 0,
        is_active: true,
      }, userId);
      return { ok: true };
    }
    case "UPDATE": {
      if (!p.target.id) return { ok: false, reason: "UPDATE richiede target.id." };
      await upsertKbEntry({
        id: p.target.id,
        title: String((p.payload?.title as string) ?? p.block_label ?? "Senza titolo"),
        content: p.after ?? "",
      } as never, userId);
      return { ok: true };
    }
    case "MOVE": {
      if (!p.target.id) return { ok: false, reason: "MOVE richiede target.id." };
      const payload = (p.payload ?? {}) as Record<string, unknown>;
      await upsertKbEntry({
        id: p.target.id,
        title: String(payload.title ?? p.block_label ?? "Senza titolo"),
        content: p.after ?? p.before ?? "",
        category: String(payload.category ?? "doctrine"),
        chapter: String(payload.chapter ?? "general"),
      } as never, userId);
      return { ok: true };
    }
    case "DELETE": {
      if (!p.target.id) return { ok: false, reason: "DELETE richiede target.id." };
      await deleteKbEntry(p.target.id);
      return { ok: true };
    }
  }
}

async function execOperativePrompt(p: HarmonizeProposal): Promise<ExecuteResult> {
  if (p.action !== "UPDATE" || !p.target.id || !p.target.field) {
    return { ok: false, reason: "operative_prompts supporta solo UPDATE con target.id + field." };
  }
  await updateOperativePrompt(p.target.id, { [p.target.field]: p.after ?? "" } as never);
  return { ok: true };
}

async function execEmailPrompt(p: HarmonizeProposal): Promise<ExecuteResult> {
  if (p.action !== "UPDATE" || !p.target.id) {
    return { ok: false, reason: "email_prompts supporta solo UPDATE con target.id." };
  }
  await updateEmailPrompt(p.target.id, { instructions: p.after ?? "" } as never);
  return { ok: true };
}

async function execEmailAddressRule(p: HarmonizeProposal): Promise<ExecuteResult> {
  if (p.action !== "UPDATE" || !p.target.id || !p.target.field) {
    return { ok: false, reason: "email_address_rules supporta solo UPDATE con field." };
  }
  await updateEmailAddressRule(p.target.id, { [p.target.field]: p.after ?? "" } as never);
  return { ok: true };
}

async function execPlaybook(p: HarmonizeProposal): Promise<ExecuteResult> {
  if (p.action !== "UPDATE" || !p.target.id || !p.target.field) {
    return { ok: false, reason: "commercial_playbooks supporta solo UPDATE con field." };
  }
  await updateCommercialPlaybook(p.target.id, { [p.target.field]: p.after ?? "" } as never);
  return { ok: true };
}

async function execAgentPersona(p: HarmonizeProposal): Promise<ExecuteResult> {
  if (p.action === "DELETE") return { ok: false, reason: "DELETE su agent_personas non consentito." };
  if (p.action !== "UPDATE" || !p.target.id || !p.target.field) {
    return { ok: false, reason: "agent_personas supporta solo UPDATE con field." };
  }
  await updateAgentPersona(p.target.id, { [p.target.field]: p.after ?? "" });
  return { ok: true };
}

async function execAgent(userId: string, p: HarmonizeProposal): Promise<ExecuteResult> {
  if (p.action === "DELETE") return { ok: false, reason: "DELETE su agents non consentito." };
  if (p.action === "MOVE") return { ok: false, reason: "MOVE non applicabile a agents." };
  const payload = (p.payload ?? {}) as Record<string, unknown>;

  if (p.action === "INSERT") {
    // Derivazione robusta dei campi minimi: il modello spesso popola solo block_label
    // e/o after. Usiamo fallback ragionevoli per evitare di bloccare l'applicazione
    // di proposte INSERT con metadati incompleti.
    const name = String(
      payload.name ?? p.block_label ?? p.target.field ?? "",
    ).trim();
    const role = String(
      payload.role ?? payload.agent_role ?? p.target.field ?? "assistant",
    ).trim() || "assistant";
    if (!name) {
      return {
        ok: false,
        reason: "INSERT agents richiede un nome (payload.name o block_label).",
      };
    }
    const insert: AgentInsert = {
      name,
      role,
      user_id: userId,
      system_prompt: String(payload.system_prompt ?? p.after ?? ""),
      avatar_emoji: payload.avatar_emoji ? String(payload.avatar_emoji) : undefined,
      knowledge_base: Array.isArray(payload.knowledge_base) ? (payload.knowledge_base as never) : undefined,
      assigned_tools: Array.isArray(payload.assigned_tools) ? (payload.assigned_tools as string[]) : undefined,
      territory_codes: Array.isArray(payload.territory_codes) ? (payload.territory_codes as string[]) : undefined,
      is_active: typeof payload.is_active === "boolean" ? (payload.is_active as boolean) : true,
    };
    await createAgent(insert);
    return { ok: true };
  }

  // UPDATE
  if (!p.target.id) return { ok: false, reason: "UPDATE agents richiede target.id." };
  const updates: AgentUpdate = {};
  if (p.target.field) {
    (updates as Record<string, unknown>)[p.target.field] = p.after ?? payload[p.target.field] ?? "";
  } else {
    // update di più campi via payload
    for (const [k, v] of Object.entries(payload)) {
      (updates as Record<string, unknown>)[k] = v;
    }
    if (p.after && !("system_prompt" in updates)) {
      (updates as Record<string, unknown>).system_prompt = p.after;
    }
  }
  if (Object.keys(updates).length === 0) {
    return { ok: false, reason: "UPDATE agents senza campi da modificare." };
  }
  await updateAgent(p.target.id, updates);
  return { ok: true };
}

async function execAppSetting(userId: string, p: HarmonizeProposal): Promise<ExecuteResult> {
  if (p.action === "DELETE" || p.action === "MOVE") {
    return { ok: false, reason: `${p.action} non supportato su app_settings.` };
  }
  const payload = (p.payload ?? {}) as Record<string, unknown>;
  const key = String(payload.key ?? p.target.field ?? p.block_label ?? "").trim();
  if (!key) return { ok: false, reason: "app_settings richiede payload.key." };
  const value = String(payload.value ?? p.after ?? "");
  if (!value) return { ok: false, reason: "app_settings richiede un valore (after o payload.value)." };
  await upsertAppSetting(userId, key, value);
  return { ok: true };
}
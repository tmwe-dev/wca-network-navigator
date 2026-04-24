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
import { logSupervisorAudit } from "@/data/supervisorAuditLog";
import type { HarmonizeProposal } from "@/data/harmonizeRuns";

export interface ExecuteResult {
  ok: boolean;
  reason?: string;
}

/** Esegue una singola proposta. Ritorna esito (no throw). */
export async function executeProposal(userId: string, p: HarmonizeProposal): Promise<ExecuteResult> {
  // 1. Skip read-only
  if (p.resolution_layer === "contract" || p.resolution_layer === "code_policy") {
    return { ok: false, reason: "Proposta read-only: richiede intervento sviluppatore." };
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
      case "app_settings":
        return { ok: false, reason: `Esecuzione su ${p.target.table} non ancora supportata in questa versione.` };
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
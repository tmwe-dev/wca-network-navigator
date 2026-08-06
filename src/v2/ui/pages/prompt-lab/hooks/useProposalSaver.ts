/**
 * useProposalSaver — Persistence layer for global prompt proposals.
 *
 * Handles:
 * - Saving proposals to appropriate database tables
 * - Block source resolution and field updates
 * - Audit logging
 */

import type { BlockSource } from "../types";
import { getAppSetting, upsertAppSetting } from "@/data/appSettings";
import { upsertKbEntry } from "@/data/kbEntries";
import { updateOperativePrompt } from "@/data/operativePrompts";
import { updateEmailPrompt } from "@/data/emailPrompts";
import { updateEmailAddressRule } from "@/data/emailAddressRules";
import { updateCommercialPlaybook } from "@/data/commercialPlaybooks";
import { updateAgentPersona } from "@/data/agentPersonas";
import { logSupervisorAudit } from "@/data/supervisorAuditLog";
import type { GlobalProposal } from "./useProposalProcessing";

const TYPES_KEY = "email_oracle_types";
const SYSTEM_PROMPT_KEY = "system_prompt_blocks";

/** Salva un singolo blocco scrivendo nel posto giusto. Ritorna {table, id} per audit. */
export async function saveProposal(userId: string, p: GlobalProposal): Promise<{ table: string; id: string }> {
  const { block } = p;
  const after = p.after ?? block.content;
  const src = block.source;

  switch (src.kind) {
    case "app_setting": {
      if (src.key === SYSTEM_PROMPT_KEY) {
        const raw = await getAppSetting(SYSTEM_PROMPT_KEY, userId);
        let stored: Array<{ id: string; label: string; content: string }> = [];
        if (raw) { try { stored = JSON.parse(raw); } catch { /* noop */ } }
        const baseId = block.id.replace(/^sp::/, "");
        const idx = stored.findIndex((s) => s.id === baseId);
        if (idx >= 0) stored[idx] = { ...stored[idx], content: after };
        else stored.push({ id: baseId, label: block.label, content: after });
        await upsertAppSetting(userId, SYSTEM_PROMPT_KEY, JSON.stringify(stored));
        return { table: "app_settings", id: SYSTEM_PROMPT_KEY };
      }
      if (src.key === TYPES_KEY) {
        const raw = await getAppSetting(TYPES_KEY, userId);
        let stored: Array<{ id: string; name: string; prompt: string }> = [];
        if (raw) { try { stored = JSON.parse(raw); } catch { /* noop */ } }
        const baseId = block.id.replace(/^et::/, "");
        const idx = stored.findIndex((s) => s.id === baseId);
        if (idx >= 0) stored[idx] = { ...stored[idx], prompt: after };
        else stored.push({ id: baseId, name: block.label.replace(/^Email type — /, ""), prompt: after });
        await upsertAppSetting(userId, TYPES_KEY, JSON.stringify(stored));
        return { table: "app_settings", id: TYPES_KEY };
      }
      throw new Error(`app_setting key ${src.key} non gestito`);
    }
    case "kb_entry": {
      if (!src.id) throw new Error("kb_entry senza id");
      await upsertKbEntry({ id: src.id, content: after, title: block.label.replace(/^\[[^\]]+\]\s*/, "") }, userId);
      return { table: "kb_entries", id: src.id };
    }
    case "operative_prompt": {
      await updateOperativePrompt(src.id, { [src.field]: after });
      return { table: "operative_prompts", id: src.id };
    }
    case "email_prompt": {
      await updateEmailPrompt(src.id, { [src.field]: after });
      return { table: "email_prompts", id: src.id };
    }
    case "email_address_rule": {
      await updateEmailAddressRule(src.id, { [src.field]: after });
      return { table: "email_address_rules", id: src.id };
    }
    case "playbook": {
      if (src.field === "trigger_conditions") {
        throw new Error("trigger_conditions non gestito da global improver");
      }
      await updateCommercialPlaybook(src.id, { [src.field]: after });
      return { table: "commercial_playbooks", id: src.id };
    }
    case "agent_persona": {
      await updateAgentPersona(src.id, { [src.field]: after });
      return { table: "agent_personas", id: src.id };
    }
    default:
      throw new Error(`source kind ${(src as BlockSource).kind} non gestito`);
  }
}

/** Audita il salvataggio di una proposta. */
export async function auditSaveProposal(meta: { table: string; id: string }, proposal: GlobalProposal): Promise<void> {
  await logSupervisorAudit({
    action: "prompt_lab_global_save",
    target_table: meta.table,
    target_id: meta.id,
    payload: { block_id: proposal.block.id, before_len: proposal.before.length, after_len: (proposal.after ?? "").length },
  });
}

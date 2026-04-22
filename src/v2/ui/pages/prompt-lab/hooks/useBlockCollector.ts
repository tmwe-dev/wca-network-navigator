/**
 * useBlockCollector — Loads all editable blocks from various sources for global improvement.
 *
 * Handles collection from:
 * - System prompt blocks
 * - KB Doctrine entries
 * - Operative prompts
 * - Email types & prompts
 * - Email address rules
 * - Commercial playbooks
 * - Agent personas
 */

import { type Block } from "../types";
import { findKbEntries } from "@/data/kbEntries";
import { getAppSetting } from "@/data/appSettings";
import { findOperativePromptsFull } from "@/data/operativePrompts";
import { findEmailPromptsByScope } from "@/data/emailPrompts";
import { findEmailAddressRules } from "@/data/emailAddressRules";
import { findCommercialPlaybooks } from "@/data/commercialPlaybooks";
import { findAgentPersonas } from "@/data/agentPersonas";
import { DEFAULT_SYSTEM_PROMPT_BLOCKS } from "../types";
import { DEFAULT_EMAIL_TYPES } from "@/data/defaultEmailTypes";

const TYPES_KEY = "email_oracle_types";
const SYSTEM_PROMPT_KEY = "system_prompt_blocks";
const DOCTRINE_CATEGORIES = ["system_doctrine", "system_core", "memory_protocol", "learning_protocol", "workflow_gate", "doctrine", "sales_doctrine"];

/** Carica TUTTA la KB doctrine come riferimento. */
export async function loadFullDoctrine(): Promise<string> {
  try {
    const all = await findKbEntries();
    const doctrine = all
      .filter((e) => DOCTRINE_CATEGORIES.includes(e.category))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    if (doctrine.length === 0) return "(KB doctrine vuota)";
    return doctrine
      .map((d) => `### [${d.category}] ${d.title}\n${d.content ?? ""}`)
      .join("\n\n");
  } catch {
    return "(impossibile caricare KB doctrine)";
  }
}

/** Collector: carica tutti i blocchi modificabili. */
export async function collectAllBlocks(userId: string): Promise<Array<{ tabLabel: string; block: Block }>> {
  const out: Array<{ tabLabel: string; block: Block }> = [];

  // 1) System prompt blocks
  try {
    const raw = await getAppSetting(SYSTEM_PROMPT_KEY, userId);
    let stored: Array<{ id: string; label?: string; content?: string }> = [];
    if (raw) { try { stored = JSON.parse(raw); } catch { /* noop */ } }
    for (const d of DEFAULT_SYSTEM_PROMPT_BLOCKS) {
      const hit = stored.find((s) => s.id === d.id);
      out.push({
        tabLabel: "System Prompt",
        block: {
          id: `sp::${d.id}`,
          label: d.label,
          content: hit?.content ?? d.content,
          source: { kind: "app_setting", key: SYSTEM_PROMPT_KEY },
          dirty: false,
        },
      });
    }
  } catch { /* skip */ }

  // 2) KB Doctrine
  try {
    const all = await findKbEntries();
    for (const e of all.filter((x) => DOCTRINE_CATEGORIES.includes(x.category)).slice(0, 80)) {
      out.push({
        tabLabel: "KB Doctrine",
        block: {
          id: e.id,
          label: `[${e.category}] ${e.title}`,
          hint: e.chapter,
          content: e.content ?? "",
          source: { kind: "kb_entry", id: e.id },
          dirty: false,
        },
      });
    }
  } catch { /* skip */ }

  // 3) Operative prompts
  try {
    const ops = await findOperativePromptsFull(userId);
    const fields = ["objective", "procedure", "criteria", "context", "examples"] as const;
    for (const p of ops) {
      for (const f of fields) {
        const val = (p[f] as string | null) ?? "";
        if (!val.trim()) continue;
        out.push({
          tabLabel: "Operative",
          block: {
            id: `${p.id}::${f}`,
            label: `${p.name} — ${f}`,
            content: val,
            source: { kind: "operative_prompt", id: p.id, field: f },
            dirty: false,
          },
        });
      }
    }
  } catch { /* skip */ }

  // 4) Email types
  try {
    const raw = await getAppSetting(TYPES_KEY, userId);
    let stored: Array<{ id: string; name?: string; prompt?: string }> = [];
    if (raw) { try { stored = JSON.parse(raw); } catch { /* noop */ } }
    const merged = DEFAULT_EMAIL_TYPES.map((t) => {
      const hit = stored.find((s) => s.id === t.id);
      return { id: t.id, name: hit?.name ?? t.name, prompt: hit?.prompt ?? t.prompt };
    });
    for (const t of merged) {
      if (!t.prompt?.trim()) continue;
      out.push({
        tabLabel: "Email",
        block: {
          id: `et::${t.id}`,
          label: `Email type — ${t.name}`,
          content: t.prompt,
          source: { kind: "app_setting", key: TYPES_KEY },
          dirty: false,
        },
      });
    }
  } catch { /* skip */ }

  // 5) Email prompts
  try {
    const list = await findEmailPromptsByScope(userId, "global");
    for (const p of list) {
      if (!p.instructions?.trim()) continue;
      out.push({
        tabLabel: "Email",
        block: {
          id: p.id,
          label: `Email global — ${p.title}`,
          content: p.instructions,
          source: { kind: "email_prompt", id: p.id, field: "instructions" },
          dirty: false,
        },
      });
    }
  } catch { /* skip */ }

  // 6) Email address rules
  try {
    const rules = await findEmailAddressRules(userId);
    for (const r of rules) {
      if (r.custom_prompt?.trim()) {
        out.push({
          tabLabel: "Email",
          block: {
            id: `${r.id}::custom_prompt`,
            label: `${r.email_address} — Prompt`,
            content: r.custom_prompt,
            source: { kind: "email_address_rule", id: r.id, field: "custom_prompt" },
            dirty: false,
          },
        });
      }
      if (r.notes?.trim()) {
        out.push({
          tabLabel: "Email",
          block: {
            id: `${r.id}::notes`,
            label: `${r.email_address} — Note`,
            content: r.notes,
            source: { kind: "email_address_rule", id: r.id, field: "notes" },
            dirty: false,
          },
        });
      }
    }
  } catch { /* skip */ }

  // 7) Playbooks
  try {
    const pbs = await findCommercialPlaybooks(userId);
    for (const p of pbs) {
      if (p.prompt_template?.trim()) {
        out.push({
          tabLabel: "Playbooks",
          block: {
            id: `${p.id}::prompt_template`,
            label: `${p.name} — Prompt`,
            content: p.prompt_template,
            source: { kind: "playbook", id: p.id, field: "prompt_template" },
            dirty: false,
          },
        });
      }
      if (p.description?.trim()) {
        out.push({
          tabLabel: "Playbooks",
          block: {
            id: `${p.id}::description`,
            label: `${p.name} — Descrizione`,
            content: p.description,
            source: { kind: "playbook", id: p.id, field: "description" },
            dirty: false,
          },
        });
      }
    }
  } catch { /* skip */ }

  // 8) Agent personas
  try {
    const personas = await findAgentPersonas(userId);
    for (const p of personas) {
      if (p.custom_tone_prompt?.trim()) {
        out.push({
          tabLabel: "Agent Personas",
          block: {
            id: `${p.id}::custom_tone_prompt`,
            label: `Persona ${p.agent_id.slice(0, 8)} — tone prompt`,
            content: p.custom_tone_prompt,
            source: { kind: "agent_persona", id: p.id, field: "custom_tone_prompt" },
            dirty: false,
          },
        });
      }
      if (p.signature_template?.trim()) {
        out.push({
          tabLabel: "Agent Personas",
          block: {
            id: `${p.id}::signature_template`,
            label: `Persona ${p.agent_id.slice(0, 8)} — signature`,
            content: p.signature_template,
            source: { kind: "agent_persona", id: p.id, field: "signature_template" },
            dirty: false,
          },
        });
      }
    }
  } catch { /* skip */ }

  return out;
}

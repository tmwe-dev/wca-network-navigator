/**
 * useGlobalPromptImprover — orchestrator del "Migliora tutto".
 *
 * Raccoglie TUTTI i blocchi modificabili dal Prompt Lab (system prompt, KB doctrine,
 * operative prompts, email prompts, address rules, playbooks, agent personas),
 * costruisce una "system map" + dottrina completa come contesto, e per ogni blocco
 * chiede al Lab Agent una versione migliorata coerente con il resto.
 *
 * Niente hard-coded constraints sulla forma: solo guard-rail in `improveBlockGlobal`.
 * Salvataggio è una fase separata (review prima di scrivere su DB).
 */
import { useCallback, useState } from "react";
import { useLabAgent } from "./useLabAgent";
import { PROMPT_LAB_TABS, type Block, type BlockSource } from "../types";
import { findKbEntries, upsertKbEntry } from "@/data/kbEntries";
import { getAppSetting, upsertAppSetting } from "@/data/appSettings";
import { findOperativePromptsFull, updateOperativePrompt } from "@/data/operativePrompts";
import { findEmailPromptsByScope, updateEmailPrompt } from "@/data/emailPrompts";
import { findEmailAddressRules, updateEmailAddressRule } from "@/data/emailAddressRules";
import { findCommercialPlaybooks, updateCommercialPlaybook } from "@/data/commercialPlaybooks";
import { findAgentPersonas, updateAgentPersona } from "@/data/agentPersonas";
import { logSupervisorAudit } from "@/data/supervisorAuditLog";
import { DEFAULT_SYSTEM_PROMPT_BLOCKS } from "../types";
import { DEFAULT_EMAIL_TYPES } from "@/data/defaultEmailTypes";

const SYSTEM_MISSION = `WCA Network Navigator è un CRM/Business Intelligence che gestisce ~12.000 partner logistici WCA.
Gli agenti AI orchestrano outreach multicanale (Email, WhatsApp, LinkedIn) seguendo la dottrina commerciale a 9 stati lead
(new → first_touch_sent → holding → engaged → qualified → negotiation → converted | archived | blacklisted).
Ogni azione passa da gate (blacklist, cadenze multicanale, dottrina di stato) e produce side-effect tracciati (activities, reminders, lead_status).
Obiettivo del sistema: massimizzare risposte qualificate, far avanzare i lead di stato in modo verificabile, mai inventare dati né bypassare governance.`;

export interface GlobalProposal {
  block: Block;
  tabLabel: string;
  tabActivation?: string;
  before: string;
  after?: string;
  status: "pending" | "improving" | "ready" | "skipped" | "error" | "saved";
  error?: string;
}

export interface GlobalImproverState {
  loading: boolean;
  phase: "idle" | "collecting" | "improving" | "review" | "saving" | "done";
  proposals: GlobalProposal[];
  progress: { current: number; total: number };
  error?: string;
}

const TYPES_KEY = "email_oracle_types";
const SYSTEM_PROMPT_KEY = "system_prompt_blocks";
const DOCTRINE_CATEGORIES = ["system_doctrine", "system_core", "memory_protocol", "learning_protocol", "workflow_gate", "doctrine", "sales_doctrine"];

/** Stringa "tab label" per ogni tipo di sorgente, per mappare ad attivazioni nel runtime. */
function tabLabelFor(src: BlockSource): string {
  switch (src.kind) {
    case "app_setting": return src.key === SYSTEM_PROMPT_KEY ? "System Prompt" : "Email";
    case "kb_entry": return "KB Doctrine";
    case "operative_prompt": return "Operative";
    case "email_prompt": return "Email";
    case "email_address_rule": return "Email";
    case "playbook": return "Playbooks";
    case "agent_persona": return "Agent Personas";
    case "agent": return "AI Profile";
    default: return "n/d";
  }
}

function activationFor(tabLabel: string): string | undefined {
  return PROMPT_LAB_TABS.find((t) => t.label === tabLabel)?.activation;
}

/** Costruisce una mappa testuale compatta di tutti i blocchi (per dare contesto al modello). */
function buildSystemMap(all: ReadonlyArray<{ tabLabel: string; block: Block }>): string {
  const groups = new Map<string, Block[]>();
  for (const { tabLabel, block } of all) {
    if (!groups.has(tabLabel)) groups.set(tabLabel, []);
    groups.get(tabLabel)!.push(block);
  }
  const lines: string[] = [];
  for (const [tab, blocks] of groups) {
    const activation = activationFor(tab);
    lines.push(`\n## TAB: ${tab}`);
    if (activation) lines.push(`Attivazione runtime: ${activation}`);
    for (const b of blocks) {
      const snippet = (b.content || "(vuoto)").slice(0, 280).replace(/\s+/g, " ").trim();
      lines.push(`- [${b.id}] ${b.label}: ${snippet}${b.content.length > 280 ? "…" : ""}`);
    }
  }
  return lines.join("\n");
}

/** Carica TUTTA la KB doctrine come riferimento, senza tagliare. */
async function loadFullDoctrine(): Promise<string> {
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

/** Collector: carica tutti i blocchi modificabili (eccetto agent.system_prompt che vive su agents). */
async function collectAllBlocks(userId: string): Promise<Array<{ tabLabel: string; block: Block }>> {
  const out: Array<{ tabLabel: string; block: Block }> = [];

  // 1) System prompt blocks (app_settings)
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

  // 3) Operative prompts (5 campi per record)
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

  // 4) Email types (app_settings)
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

  // 5) Email prompts (scope=global)
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

  // 6) Email address rules (custom_prompt + notes)
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

  // 7) Playbooks (prompt_template + description)
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

  // 8) Agent personas (custom_tone_prompt + signature_template; arrays esclusi: poco testo)
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

/** Salva un singolo blocco scrivendo nel posto giusto. Ritorna {table, id} per audit. */
async function saveProposal(userId: string, p: GlobalProposal): Promise<{ table: string; id: string }> {
  const { block } = p;
  const after = p.after ?? block.content;
  const src = block.source;

  switch (src.kind) {
    case "app_setting": {
      // System prompt blocks
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
      // Email types
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
        // non miglioriamo JSON in global; skip safe
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

export function useGlobalPromptImprover(userId: string, goal: string) {
  const lab = useLabAgent();
  const [state, setState] = useState<GlobalImproverState>({
    loading: false,
    phase: "idle",
    proposals: [],
    progress: { current: 0, total: 0 },
  });

  const reset = useCallback(() => {
    setState({ loading: false, phase: "idle", proposals: [], progress: { current: 0, total: 0 } });
  }, []);

  /** Step 1+2: raccoglie e migliora tutti i blocchi (uno alla volta, sequenziale per evitare rate limit). */
  const startImprovement = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, loading: true, phase: "collecting", proposals: [], progress: { current: 0, total: 0 }, error: undefined }));

    let collected: Array<{ tabLabel: string; block: Block }> = [];
    let doctrineFull = "";
    let systemMap = "";

    try {
      collected = await collectAllBlocks(userId);
      doctrineFull = await loadFullDoctrine();
      systemMap = buildSystemMap(collected);
    } catch (e) {
      setState((s) => ({ ...s, loading: false, phase: "idle", error: e instanceof Error ? e.message : String(e) }));
      return;
    }

    const initial: GlobalProposal[] = collected.map(({ tabLabel, block }) => ({
      block,
      tabLabel,
      tabActivation: activationFor(tabLabel),
      before: block.content,
      status: "pending",
    }));

    setState({
      loading: true,
      phase: "improving",
      proposals: initial,
      progress: { current: 0, total: initial.length },
    });

    for (let i = 0; i < initial.length; i++) {
      const p = initial[i];
      setState((s) => ({
        ...s,
        progress: { current: i, total: initial.length },
        proposals: s.proposals.map((x, idx) => (idx === i ? { ...x, status: "improving" } : x)),
      }));

      try {
        const improved = await lab.improveBlockGlobal({
          block: p.block,
          tabLabel: p.tabLabel,
          tabActivation: p.tabActivation,
          systemMap,
          doctrineFull,
          systemMission: SYSTEM_MISSION,
          goal: goal.trim() || undefined,
        });
        const isSame = improved.trim() === p.before.trim();
        setState((s) => ({
          ...s,
          proposals: s.proposals.map((x, idx) =>
            idx === i
              ? { ...x, after: improved, status: isSame ? "skipped" : "ready" }
              : x,
          ),
        }));
      } catch (e) {
        setState((s) => ({
          ...s,
          proposals: s.proposals.map((x, idx) =>
            idx === i
              ? { ...x, status: "error", error: e instanceof Error ? e.message : String(e) }
              : x,
          ),
        }));
      }
    }

    setState((s) => ({
      ...s,
      loading: false,
      phase: "review",
      progress: { current: initial.length, total: initial.length },
    }));
  }, [lab, userId, goal]);

  /** Step 3: salva tutti i blocchi marcati "ready" + accettati (saveOnlyIds) sul DB. */
  const saveAccepted = useCallback(async (acceptedIds: ReadonlySet<string>) => {
    setState((s) => ({ ...s, loading: true, phase: "saving" }));
    const toSave = state.proposals.filter((p) => p.status === "ready" && acceptedIds.has(p.block.id));

    for (let i = 0; i < toSave.length; i++) {
      const p = toSave[i];
      try {
        const meta = await saveProposal(userId, p);
        await logSupervisorAudit({
          action: "prompt_lab_global_save",
          target_table: meta.table,
          target_id: meta.id,
          payload: { block_id: p.block.id, before_len: p.before.length, after_len: (p.after ?? "").length },
        });
        setState((s) => ({
          ...s,
          proposals: s.proposals.map((x) => (x.block.id === p.block.id ? { ...x, status: "saved" } : x)),
        }));
      } catch (e) {
        setState((s) => ({
          ...s,
          proposals: s.proposals.map((x) =>
            x.block.id === p.block.id ? { ...x, status: "error", error: e instanceof Error ? e.message : String(e) } : x,
          ),
        }));
      }
    }

    setState((s) => ({ ...s, loading: false, phase: "done" }));
  }, [state.proposals, userId]);

  return { state, startImprovement, saveAccepted, reset };
}
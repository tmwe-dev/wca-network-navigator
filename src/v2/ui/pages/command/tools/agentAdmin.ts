/**
 * Tools: toggle-agent, update-agent-persona.
 */
import type { Tool, ToolResult, ToolContext } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { mergePayload, isUuid } from "./_helpers/writePayload";

type TogglePayload = { agent_id?: string; agent_name?: string; active?: boolean; [k: string]: unknown };

async function resolveAgent(ref: string): Promise<{ id: string; name: string } | null> {
  if (!ref) return null;
  if (isUuid(ref)) {
    const { data } = await supabase.from("agents").select("id, name").eq("id", ref).maybeSingle();
    return data ? { id: data.id as string, name: (data.name ?? "") as string } : null;
  }
  const { data } = await supabase.from("agents").select("id, name").ilike("name", `%${ref}%`).limit(1).maybeSingle();
  return data ? { id: data.id as string, name: (data.name ?? "") as string } : null;
}

export const toggleAgentTool: Tool = {
  id: "toggle-agent",
  label: "Attiva/Disattiva agente",
  description: "Attiva o disattiva un agente AI",
  match: (p) => /\b(attiva|disattiva|abilita|disabilita)\s+(l')?agente/i.test(p),
  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const active = !/\b(disattiv|disabilit|spegn)/i.test(prompt);
    const id = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
    const name = prompt.match(/agente\s+"?([\w\s]+?)"?(?:\s|$)/i)?.[1]?.trim();
    const payload = mergePayload<TogglePayload>(context?.payload, { agent_id: id, agent_name: name, active });
    const ref = String(payload.agent_id || payload.agent_name || "").trim();
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: payload.active ? "Attivare agente?" : "Disattivare agente?",
        description: "L'agente verrà aggiornato.",
        details: [
          { label: "Agente", value: ref || "(mancante)" },
          { label: "Nuovo stato", value: payload.active ? "attivo" : "inattivo" },
        ],
        governance: { role: "admin", permission: "WRITE:AGENTS", policy: "agent-toggle" },
        pendingPayload: payload,
        toolId: "toggle-agent",
      };
    }
    if (!ref) throw new Error("Riferimento agente mancante");
    const resolved = await resolveAgent(ref);
    if (!resolved) throw new Error(`Agente "${ref}" non trovato`);
    const { error } = await supabase.from("agents").update({ is_active: !!payload.active }).eq("id", resolved.id);
    if (error) throw new Error(error.message);
    return {
      kind: "result",
      title: payload.active ? "🟢 Agente attivato" : "⚪ Agente disattivato",
      message: `${resolved.name} ora è ${payload.active ? "attivo" : "inattivo"}.`,
      meta: { count: 1, sourceLabel: "Supabase · agents" },
    };
  },
};

type PersonaPayload = {
  agent_id?: string;
  agent_name?: string;
  updates?: Record<string, unknown>;
  [k: string]: unknown;
};

export const updateAgentPersonaTool: Tool = {
  id: "update-agent-persona",
  label: "Aggiorna persona agente",
  description: "Aggiorna la persona (tono/lingua/prompt) di un agente",
  match: (p) => /\b(aggiorna|modifica)\s+(persona|tono|prompt)\s+(dell')?agente/i.test(p),
  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const payload = mergePayload<PersonaPayload>(context?.payload, {});
    const ref = String(payload.agent_id || payload.agent_name || "").trim();
    const updates = (payload.updates as Record<string, unknown>) ?? {};
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Aggiornare persona agente?",
        description: "La persona verrà sovrascritta con i nuovi campi.",
        details: [
          { label: "Agente", value: ref || "(mancante)" },
          { label: "Campi", value: Object.keys(updates).join(", ") || "(nessuno)" },
        ],
        governance: { role: "admin", permission: "WRITE:PERSONAS", policy: "persona-update" },
        pendingPayload: payload,
        toolId: "update-agent-persona",
      };
    }
    if (!ref) throw new Error("Riferimento agente mancante");
    if (Object.keys(updates).length === 0) throw new Error("Nessun aggiornamento fornito");
    const resolved = await resolveAgent(ref);
    if (!resolved) throw new Error(`Agente "${ref}" non trovato`);
    const { error } = await supabase.from("agent_personas").update(updates as never).eq("agent_id", resolved.id);
    if (error) throw new Error(error.message);
    return {
      kind: "result",
      title: "🎭 Persona aggiornata",
      message: `Persona di ${resolved.name} aggiornata (${Object.keys(updates).join(", ")}).`,
      meta: { count: 1, sourceLabel: "Supabase · agent_personas" },
    };
  },
};
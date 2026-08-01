/**
 * Tool: create-agent — Create a new AI agent (requires approval)
 */
import { createAgent } from "@/v2/io/supabase/mutations/agents";
import { supabase } from "@/integrations/supabase/client";
import { isOk } from "@/v2/core/domain/result";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractPayload(prompt: string): Record<string, unknown> {
  const nameMatch = prompt.match(/(?:agente|agent)\s+["']?([A-Z][\w\s]+)/i);
  const roleMatch = prompt.match(/(?:ruolo|role)\s+["']?(\w+)/i);
  return {
    name: nameMatch?.[1]?.trim() ?? "",
    role: roleMatch?.[1] ?? "outreach",
    system_prompt: "",
    avatar_emoji: "🤖",
  };
}

export const createAgentTool: Tool = {
  id: "create-agent",
  label: "Crea agente AI",
  description: "Crea un nuovo agente AI con ruolo e configurazione personalizzati",
  match: (p) => /(crea|nuovo)\s+agente/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      const payload = extractPayload(prompt);
      return {
        kind: "approval",
        title: "Creare nuovo agente AI?",
        description: "Un nuovo agente verrà aggiunto al sistema con il ruolo specificato.",
        details: [
          { label: "Nome", value: String(payload.name || "(da compilare)") },
          { label: "Ruolo", value: String(payload.role) },
          { label: "Emoji", value: String(payload.avatar_emoji) },
        ],
        governance: { role: "ADMIN", permission: "WRITE:AGENTS", policy: "POLICY v1.0 · SOFT-SYNC" },
        pendingPayload: payload,
        toolId: "create-agent",
      };
    }

    const p = context.payload ?? {};
    const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
    if (!user) throw new Error("Non autenticato");

    const result = await createAgent({
      user_id: user.id,
      name: String(p.name ?? "Nuovo Agente"),
      role: String(p.role ?? "outreach"),
      system_prompt: String(p.system_prompt ?? ""),
      avatar_emoji: String(p.avatar_emoji ?? "🤖"),
    });

    if (!isOk(result)) throw new Error(result.error.message);

    return {
      kind: "result",
      title: "Agente creato",
      message: `Agente "${result.value.name}" creato con successo.`,
      meta: { count: 1, sourceLabel: "Supabase · agents" },
    };
  },
};

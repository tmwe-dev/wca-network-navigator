// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AGENT PERSONA LOADER — DB-backed identity/tone/style.
// Used by agent-loop, agent-execute, and any other edge function
// that wants persona to apply instantly without redeploy.
// Soft-fail: returns null if table is unreachable or no persona configured.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import type { SupabaseClient as BaseSupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// deno-lint-ignore no-explicit-any
type SupabaseClient = BaseSupabaseClient<any, "public", any>;

export interface PersonaData {
  tone?: string;
  custom_tone_prompt?: string | null;
  language?: string;
  style_rules?: string[];
  vocabulary_do?: string[];
  vocabulary_dont?: string[];
  example_messages?: Array<{ role: string; content: string }>;
  signature_template?: string | null;
}

/**
 * Load persona row by agent_id (and optional user_id).
 * Soft-fails to null on any error.
 */
export async function loadAgentPersona(
  supabase: SupabaseClient,
  agentId: string,
  userId?: string,
): Promise<PersonaData | null> {
  if (!agentId) return null;
  try {
    let q = supabase.from("agent_personas").select("*").eq("agent_id", agentId);
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q.maybeSingle();
    if (error) {
      console.warn("[agentPersonaLoader] query error:", error.message);
      return null;
    }
    return (data ?? null) as PersonaData | null;
  } catch (e) {
    console.warn("[agentPersonaLoader] load failed:", (e as Error).message);
    return null;
  }
}

/**
 * Render persona as a prompt block. Empty string when persona is null/empty.
 * Always wrapped in --- PERSONA --- markers so it can be appended to any prompt.
 */
export function renderPersonaBlock(persona: PersonaData | null): string {
  if (!persona) return "";

  const tone = persona.tone || "professional";
  const customTone = (persona.custom_tone_prompt ?? "").trim();
  const lang = persona.language || "it";
  const styleRules = persona.style_rules ?? [];
  const vocDo = persona.vocabulary_do ?? [];
  const vocDont = persona.vocabulary_dont ?? [];
  const examples = persona.example_messages ?? [];
  const signature = (persona.signature_template ?? "").trim();

  const lines: string[] = [];
  lines.push("--- PERSONA ---");
  lines.push(`TONO: ${tone}${tone === "custom" && customTone ? ` (${customTone})` : ""}`);
  lines.push(`LINGUA: ${lang}`);
  if (styleRules.length) {
    lines.push("STILE:");
    for (const r of styleRules) lines.push(`- ${r}`);
  }
  if (vocDo.length) lines.push(`USA SEMPRE: ${vocDo.join(", ")}`);
  if (vocDont.length) lines.push(`EVITA SEMPRE: ${vocDont.join(", ")}`);
  if (examples.length) {
    lines.push("ESEMPI MESSAGGI:");
    for (const ex of examples.slice(0, 5)) {
      lines.push(`[${ex.role}]: ${ex.content}`);
    }
  }
  if (signature) lines.push(`FIRMA: ${signature}`);
  return lines.join("\n");
}
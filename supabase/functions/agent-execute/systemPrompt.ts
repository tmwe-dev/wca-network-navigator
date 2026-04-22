// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYSTEM PROMPT ASSEMBLY - Base Doctrine, Persona, Knowledge
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { assembleContext, getContextBudget } from "../_shared/tokenBudget.ts";
import { loadCommercialDoctrine } from "../_shared/commercialDoctrine.ts";

type SupabaseClient = ReturnType<typeof createClient>;

interface PersonaData {
  tone?: string;
  language?: string;
  style_rules?: string[];
  vocabulary_do?: string[];
  vocabulary_dont?: string[];
  example_messages?: Array<{ role: string; content: string }>;
  signature_template?: string;
}

/**
 * Load agent persona and associated KB entries
 */
export async function loadAgentPersona(
  supabase: SupabaseClient,
  agentId: string,
  userId: string
): Promise<{ persona: PersonaData | null; kbEntries: Array<{ title: string; content: string; chapter?: string; category?: string }> }> {
  let persona: PersonaData | null = null;
  let personaKbEntries: Array<{ title: string; content: string; chapter?: string; category?: string }> = [];

  try {
    const { data: p } = await supabase
      .from("agent_personas")
      .select("*")
      .eq("agent_id", agentId)
      .eq("user_id", userId)
      .maybeSingle();
    persona = p as PersonaData | null;
  } catch (_) {
    /* table may not exist yet */
  }

  if (persona) {
    try {
      const { data: kbLinks } = await supabase
        .from("agent_knowledge_links")
        .select("kb_entry_id, priority")
        .eq("agent_id", agentId)
        .eq("user_id", userId)
        .order("priority", { ascending: false });
      if (kbLinks?.length) {
        const kbIds = kbLinks.map((l: { kb_entry_id: string }) => l.kb_entry_id);
        const { data: entries } = await supabase
          .from("kb_entries")
          .select("title, content, chapter, category")
          .in("id", kbIds)
          .eq("is_active", true);
        if (entries) personaKbEntries = entries;
      }
    } catch (_) {
      /* table may not exist yet */
    }
  }

  return { persona, kbEntries: personaKbEntries };
}

/**
 * Build system prompt with base doctrine + persona + KB
 */
function buildBasePrompt(agentPrompt: string, persona: PersonaData | null): string {
  let systemPrompt = agentPrompt || "Sei un agente AI.";

  if (persona) {
    const tone = persona.tone || "professional";
    const lang = persona.language || "it";
    const styleRules = persona.style_rules || [];
    const vocDo = persona.vocabulary_do || [];
    const vocDont = persona.vocabulary_dont || [];
    const examples = persona.example_messages || [];
    const signature = persona.signature_template || "";

    systemPrompt += `\n\n--- PERSONA ---`;
    systemPrompt += `\nTONO: ${tone}`;
    systemPrompt += `\nLINGUA: ${lang}`;
    if (styleRules.length) systemPrompt += `\nSTILE:\n${styleRules.map((r: string) => `- ${r}`).join("\n")}`;
    if (vocDo.length) systemPrompt += `\nUSA SEMPRE: ${vocDo.join(", ")}`;
    if (vocDont.length) systemPrompt += `\nEVITA SEMPRE: ${vocDont.join(", ")}`;
    if (examples.length) {
      systemPrompt += `\nESEMPI MESSAGGI:`;
      for (const ex of examples.slice(0, 5)) {
        systemPrompt += `\n[${ex.role}]: ${ex.content}`;
      }
    }
    if (signature) systemPrompt += `\nFIRMA: ${signature}`;
  }

  return systemPrompt;
}

/**
 * Assemble complete system prompt with token budget awareness
 */
export async function assembleSystemPrompt(
  supabase: SupabaseClient,
  agentPrompt: string,
  persona: PersonaData | null,
  personaKbEntries: Array<{ title: string; content: string; chapter?: string; category?: string }>,
  agentKbEntries: Array<{ title: string; content: string }> | null,
  contextBlock: string,
  learningBlock: string,
  missionBlock: string,
  userId: string
): Promise<string> {
  const baseDoctrine = buildBasePrompt(agentPrompt, persona);

  // Add system access note
  const systemAccessNote = `
- Hai accesso COMPLETO a: tutti i tool operativi, KB globale, prompt operativi, team roster, storico attività dei colleghi, i tuoi clienti assegnati.
- Consulta la KB e i prompt operativi prima di agire.
- Usa search_memory per recuperare decisioni e contesto storico.
- I tuoi clienti assegnati sono nel contesto sopra. Usa list_agent_tasks per i tuoi task.
- Puoi vedere le attività di TUTTI i colleghi per coordinamento.
- Le regole commerciali e di governance sono nella Knowledge Base e nei Prompt Operativi — seguile.

Rispondi nella lingua configurata dall'utente. Usa markdown per formattare le risposte. Sei un agente operativo che agisce sul database reale — non simulare, esegui le azioni.`;

  const fullBaseDoctrine = `${baseDoctrine}\n\nACCESSO SISTEMA:${systemAccessNote}`;

  // Load commercial doctrine
  const doctrineLoaded = await loadCommercialDoctrine(supabase, userId);
  const commercialDoctrineBlock = doctrineLoaded.text;
  console.log(`[systemPrompt] Doctrine source=${doctrineLoaded.source} entries=${doctrineLoaded.entriesLoaded}`);

  // Format KB blocks
  const personaKbBlock = personaKbEntries.length
    ? "\n\n--- KNOWLEDGE BASE (AGENTE) ---\n" + personaKbEntries.map((k: { title: string; content: string }) => `### ${k.title}\n${(k.content as string).substring(0, 800)}\n`).join("\n")
    : "";

  const agentKbBlock = agentKbEntries?.length
    ? "\n\n--- KNOWLEDGE BASE ---\n" + agentKbEntries.map((e: { title: string; content: string }) => `### ${e.title}\n${e.content}`).join("\n")
    : "";

  // Assemble with context budget
  const contextBudget = getContextBudget("google/gemini-3-flash-preview");
  const assembled = assembleContext(
    [
      { key: "doctrine", content: fullBaseDoctrine, priority: 100, minTokens: 500 },
      { key: "commercial_doctrine", content: commercialDoctrineBlock, priority: 98, minTokens: 800 },
      { key: "mission", content: missionBlock, priority: 95, minTokens: 200 },
      { key: "persona_kb", content: personaKbBlock, priority: 90, minTokens: 300 },
      { key: "context", content: contextBlock, priority: 80, minTokens: 500 },
      { key: "learning", content: learningBlock, priority: 70, minTokens: 200 },
      { key: "agent_kb", content: agentKbBlock, priority: 60, minTokens: 300 },
    ],
    contextBudget
  );

  console.log(
    `[systemPrompt] Context: ${assembled.stats.totalTokens}/${contextBudget} tokens, included=${assembled.stats.included.join(",")}, truncated=${assembled.stats.truncated.join(",") || "none"}, dropped=${assembled.stats.dropped.join(",") || "none"}`
  );

  return assembled.text;
}

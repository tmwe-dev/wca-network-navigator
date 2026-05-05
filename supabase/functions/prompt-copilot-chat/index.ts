/**
 * Edge function: prompt-copilot-chat
 *
 * Chat AI ↔ KB del Prompt Reader. **Non scrive** mai sui prompt attivi:
 * produce solo proposte (testo nuovo per un blocco) che la UI salverà
 * in `prompt_change_proposals` come change request da revisionare.
 *
 * Modalità:
 *  - mode='diagnose': ruolo Architect (guida COBRA). Diagnosi, no scritture.
 *  - mode='edit'    : ruolo Editor. Propone diff su UN blocco specifico.
 *
 * Carica KB tramite kb-index-map → seleziona famiglie pertinenti → legge
 * solo le entry attive in quelle famiglie filtrate per agente target.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";

interface Body {
  agent_slug?: string;
  agent_kb_categories?: string[];
  block_name?: string;
  current_content?: string;
  user_message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  mode?: "diagnose" | "edit";
  intent?: string; // chiave INTENT_ROUTING
}

const FAMILY_MAP: Record<string, string> = {
  doctrine: "doctrine", system_doctrine: "doctrine", agent_doctrine: "doctrine",
  sales_doctrine: "doctrine", filosofia: "doctrine", regole_sistema: "doctrine",
  procedures: "procedures", lab_architect_procedure: "procedures",
  command_tools: "procedures", email_management: "procedures",
  voice_rules: "personas", tono: "personas", calligrafia: "personas", chris_voss: "personas",
  cold_outreach: "playbooks", followup: "playbooks", negoziazione: "playbooks",
  obiezioni: "playbooks", chiusura: "playbooks", hook: "playbooks",
  frasi_modello: "playbooks", struttura_email: "playbooks", prompt_template: "playbooks",
  arsenale: "playbooks", persuasione: "playbooks",
  errori: "glossary", dati_partner: "data-schema",
};

const INTENT_TO_FAMILIES: Record<string, string[]> = {
  validate_identity: ["personas", "doctrine"],
  validate_objective: ["doctrine", "procedures"],
  validate_method: ["procedures", "playbooks"],
  validate_guardrail: ["doctrine", "glossary"],
  validate_output: ["playbooks"],
  improve_email: ["playbooks", "personas"],
  generic: ["doctrine", "procedures"],
};

const BLOCK_TO_INTENT: Record<string, string> = {
  context: "validate_identity", identity: "validate_identity",
  objective: "validate_objective",
  procedure: "validate_method", method: "validate_method",
  criteria: "validate_guardrail", guardrail: "validate_guardrail",
  examples: "validate_output", output: "validate_output",
};

function systemPrompt(mode: "diagnose" | "edit", blockName?: string): string {
  if (mode === "diagnose") {
    return [
      "Sei l'Architect del Prompt Lab (guida COBRA).",
      "Analizzi prompt come sistema. NON modifichi nulla.",
      "Produci diagnosi strutturale: punti di rischio, sezioni mancanti, raccomandazioni.",
      "Restituisci JSON con campi: diagnosis, risk_points[], missing_sections[], recommendations[].",
    ].join("\n");
  }
  return [
    "Sei l'Editor del Prompt Lab (guida COBRA).",
    `Modifichi SOLO il blocco \`${blockName ?? "<non specificato>"}\` di un prompt operativo.`,
    "NON riscrivi l'intero prompt. Modifica chirurgica, minima, reversibile.",
    "Usa le KB fornite come fonte di verità. Cita le entry consultate.",
    "Restituisci una risposta in linguaggio naturale CHIARA + alla fine un blocco JSON così:",
    "```json",
    "{",
    '  "proposed_content": "...nuovo testo del blocco...",',
    '  "rationale": "...perché questa modifica...",',
    '  "risks": "...cosa potrebbe rompersi...",',
    '  "assumptions": "...cosa do per scontato..."',
    "}",
    "```",
  ].join("\n");
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = (await req.json()) as Body;
    const mode = body.mode ?? "edit";
    const intent = body.intent ?? (body.block_name ? BLOCK_TO_INTENT[body.block_name] : "generic") ?? "generic";
    const families = INTENT_TO_FAMILIES[intent] ?? INTENT_TO_FAMILIES.generic;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. KB pertinenti: filtra per famiglia + (opz.) intersezione con kbCategories agente
    const targetCats = Object.entries(FAMILY_MAP)
      .filter(([, fam]) => families.includes(fam))
      .map(([cat]) => cat);

    const filterCats = body.agent_kb_categories?.length
      ? targetCats.filter((c) => body.agent_kb_categories!.includes(c))
      : targetCats;

    let kb: Array<{ id: string; category: string; chapter: string | null; title: string; content: string; priority: number }> = [];
    if (filterCats.length > 0) {
      const { data, error } = await supabase
        .from("kb_entries")
        .select("id, category, chapter, title, content, priority")
        .eq("is_active", true)
        .in("category", filterCats)
        .order("priority", { ascending: false })
        .limit(25);
      if (error) throw error;
      kb = data as typeof kb;
    }

    // 2. Costruisci messaggi per Lovable AI
    const kbBlock = kb.length === 0
      ? "(nessuna entry KB pertinente trovata)"
      : kb.map((e) =>
          `### [${e.category}/${e.chapter ?? "-"}] ${e.title} (id:${e.id})\n${e.content}`,
        ).join("\n\n");

    const sys = systemPrompt(mode, body.block_name);
    const userParts: string[] = [];
    if (body.agent_slug) userParts.push(`AGENTE: ${body.agent_slug}`);
    if (body.block_name) userParts.push(`BLOCCO TARGET: ${body.block_name}`);
    if (body.current_content) {
      userParts.push(`\nCONTENUTO ATTUALE DEL BLOCCO:\n---\n${body.current_content}\n---`);
    }
    userParts.push(`\nKNOWLEDGE BASE PERTINENTE (${kb.length} entry):\n${kbBlock}`);
    userParts.push(`\nRICHIESTA UTENTE:\n${body.user_message}`);

    const messages = [
      { role: "system", content: sys },
      ...(body.history ?? []),
      { role: "user", content: userParts.join("\n") },
    ];

    // 3. Chiamata Lovable AI Gateway
    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) throw new Error("LOVABLE_API_KEY non configurata");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit raggiunto, riprova tra poco." }),
          { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }),
          { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const t = await aiResp.text();
      return new Response(JSON.stringify({ error: "AI gateway error", detail: t }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const aiJson = await aiResp.json();
    const reply = aiJson?.choices?.[0]?.message?.content ?? "";

    // Estrai eventuale blocco JSON proposta (modalità edit)
    let proposal: { proposed_content?: string; rationale?: string; risks?: string; assumptions?: string } | null = null;
    if (mode === "edit") {
      const m = reply.match(/```json\s*([\s\S]*?)```/);
      if (m) {
        try { proposal = JSON.parse(m[1]); } catch { /* ignore parse errors */ }
      }
    }

    return new Response(JSON.stringify({
      reply,
      proposal,
      kb_consulted: kb.map((e) => ({ id: e.id, category: e.category, chapter: e.chapter, title: e.title })),
      families_used: families,
      intent,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
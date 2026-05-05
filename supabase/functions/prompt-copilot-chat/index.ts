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
  mode?: "diagnose" | "edit" | "global";
  /** Per mode='global': termine da cercare in tutti i prompt + KB */
  search_term?: string;
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

function fallbackSystemPrompt(mode: "diagnose" | "edit" | "global", blockName?: string): string {
  if (mode === "diagnose") {
    return [
      "Sei l'Architect del Prompt Lab (guida COBRA).",
      "Analizzi prompt come sistema. NON modifichi nulla.",
      "Produci diagnosi strutturale: punti di rischio, sezioni mancanti, raccomandazioni.",
      "Restituisci JSON con campi: diagnosis, risk_points[], missing_sections[], recommendations[].",
    ].join("\n");
  }
  if (mode === "global") {
    return [
      "Sei il Curatore di Prompt e KB. Modalità GLOBALE: ricerca-sostituzione su prompt + KB.",
      "Esamina ogni occorrenza nel suo contesto. Non sostituire alla cieca.",
      "Restituisci JSON in fondo: { global_replacements:[{source_kind,source_id,source_label,field,old_excerpt,new_excerpt,rationale,risk}], skipped:[{source_id,reason}] }",
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

/**
 * Carica il prompt operativo "KB & Prompt Curator" dal DB e lo usa come system prompt.
 * Se non trovato, usa fallback hard-coded. Così l'utente può modificarlo dal Prompt Lab.
 */
async function loadCuratorSystemPrompt(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  mode: "diagnose" | "edit" | "global",
  blockName?: string,
): Promise<string> {
  const { data } = await supabase
    .from("operative_prompts")
    .select("objective, procedure, criteria, examples")
    .eq("name", "KB & Prompt Curator")
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return fallbackSystemPrompt(mode, blockName);
  const parts: string[] = [];
  if (data.objective) parts.push(`# IDENTITÀ + OBIETTIVO\n${data.objective}`);
  if (data.procedure) parts.push(`# METODO\n${data.procedure}`);
  if (data.criteria) parts.push(`# GUARDRAIL + OUTPUT\n${data.criteria}`);
  if (data.examples) parts.push(`# ESEMPI\n${data.examples}`);
  parts.push(`\n# MODALITÀ ATTIVA: ${mode.toUpperCase()}${blockName ? ` (blocco target: ${blockName})` : ""}`);
  return parts.join("\n\n");
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

    // ── Costruzione contesto in base alla modalità ────────────────────
    let kb: Array<{ id: string; category: string; chapter: string | null; title: string; content: string; priority: number }> = [];
    let occurrences: Array<{ kind: "operative_prompt" | "kb_entry"; id: string; label: string; field: string; excerpt: string }> = [];

    if (mode === "global") {
      // Cerca termine in operative_prompts (objective/procedure/criteria/examples) e kb_entries (title/content)
      const term = (body.search_term ?? body.user_message ?? "").trim();
      if (term.length >= 2) {
        const like = `%${term}%`;
        const { data: prompts } = await supabase
          .from("operative_prompts")
          .select("id, name, objective, procedure, criteria, examples")
          .eq("is_active", true)
          .or(`objective.ilike.${like},procedure.ilike.${like},criteria.ilike.${like},examples.ilike.${like}`)
          .limit(40);
        for (const p of (prompts ?? []) as Array<Record<string, string | null>>) {
          for (const f of ["objective", "procedure", "criteria", "examples"] as const) {
            const v = (p[f] ?? "") as string;
            if (v && v.toLowerCase().includes(term.toLowerCase())) {
              const idx = v.toLowerCase().indexOf(term.toLowerCase());
              const start = Math.max(0, idx - 120);
              const end = Math.min(v.length, idx + term.length + 120);
              occurrences.push({
                kind: "operative_prompt",
                id: p.id as unknown as string,
                label: (p.name as unknown as string) ?? "(senza nome)",
                field: f,
                excerpt: (start > 0 ? "…" : "") + v.slice(start, end) + (end < v.length ? "…" : ""),
              });
            }
          }
        }
        const { data: kbHits } = await supabase
          .from("kb_entries")
          .select("id, category, chapter, title, content")
          .eq("is_active", true)
          .or(`title.ilike.${like},content.ilike.${like}`)
          .limit(40);
        for (const e of (kbHits ?? []) as Array<Record<string, string | null>>) {
          const v = (e.content ?? "") as string;
          const idx = v.toLowerCase().indexOf(term.toLowerCase());
          const start = Math.max(0, idx - 120);
          const end = Math.min(v.length, idx + term.length + 120);
          occurrences.push({
            kind: "kb_entry",
            id: e.id as unknown as string,
            label: `[${e.category ?? ""}/${e.chapter ?? "-"}] ${e.title ?? ""}`,
            field: "content",
            excerpt: idx >= 0 ? (start > 0 ? "…" : "") + v.slice(start, end) + (end < v.length ? "…" : "") : (e.title ?? ""),
          });
        }
      }
    } else {
      // BLOCCO/INTAKE: KB pertinenti per famiglia
      const targetCats = Object.entries(FAMILY_MAP)
        .filter(([, fam]) => families.includes(fam))
        .map(([cat]) => cat);
      const filterCats = body.agent_kb_categories?.length
        ? targetCats.filter((c) => body.agent_kb_categories!.includes(c))
        : targetCats;
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
    }

    // ── Messaggi per Lovable AI ───────────────────────────────────────
    const sys = await loadCuratorSystemPrompt(supabase, mode, body.block_name);
    const userParts: string[] = [];
    if (body.agent_slug) userParts.push(`AGENTE: ${body.agent_slug}`);
    if (body.block_name) userParts.push(`BLOCCO TARGET: ${body.block_name}`);
    if (body.current_content) {
      userParts.push(`\nCONTENUTO ATTUALE DEL BLOCCO:\n---\n${body.current_content}\n---`);
    }
    if (mode === "global") {
      userParts.push(`\nMODALITÀ: GLOBALE — ricerca-sostituzione su prompt + KB`);
      if (body.search_term) userParts.push(`TERMINE CERCATO: "${body.search_term}"`);
      const occBlock = occurrences.length === 0
        ? "(nessuna occorrenza trovata)"
        : occurrences.map((o) =>
            `- [${o.kind}] ${o.label}\n  id: ${o.id} · campo: ${o.field}\n  estratto: ${o.excerpt}`,
          ).join("\n\n");
      userParts.push(`\nOCCORRENZE TROVATE (${occurrences.length}):\n${occBlock}`);
    } else {
      const kbBlock = kb.length === 0
        ? "(nessuna entry KB pertinente trovata)"
        : kb.map((e) =>
            `### [${e.category}/${e.chapter ?? "-"}] ${e.title} (id:${e.id})\n${e.content}`,
          ).join("\n\n");
      userParts.push(`\nKNOWLEDGE BASE PERTINENTE (${kb.length} entry):\n${kbBlock}`);
    }
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

    // Estrai blocco JSON finale (modalità edit/global)
    // Tolleriamo: ```json ... ```, ``` ... ```, oppure ultimo {...} bilanciato nel testo.
    let proposal: { proposed_content?: string; rationale?: string; risks?: string; assumptions?: string } | null = null;
    let globalProposal: { global_replacements?: unknown[]; skipped?: unknown[] } | null = null;
    function extractJsonCandidate(text: string): string | null {
      const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fence?.[1]) return fence[1].trim();
      // ultimo blocco {...} bilanciato
      let depth = 0, start = -1, last: { s: number; e: number } | null = null;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === "{") { if (depth === 0) start = i; depth++; }
        else if (c === "}") { depth--; if (depth === 0 && start >= 0) { last = { s: start, e: i + 1 }; start = -1; } }
      }
      return last ? text.slice(last.s, last.e) : null;
    }
    const candidate = extractJsonCandidate(reply);
    const parsed: Record<string, unknown> | null = candidate
      ? (() => { try { return JSON.parse(candidate); } catch { return null; } })()
      : null;
    if (parsed) {
      if (mode === "edit" && typeof parsed.proposed_content === "string") {
        proposal = parsed as typeof proposal;
      } else if (mode === "global" && Array.isArray(parsed.global_replacements)) {
        globalProposal = parsed as typeof globalProposal;
      }
    }

    return new Response(JSON.stringify({
      reply,
      proposal,
      global_proposal: globalProposal,
      occurrences,
      kb_consulted: kb.map((e) => ({ id: e.id, category: e.category, chapter: e.chapter, title: e.title })),
      families_used: families,
      intent,
      mode,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
/**
 * Edge function: kb-index-map
 *
 * Read-only. Restituisce una mappa navigabile della Knowledge Base:
 *  - aggregazione per famiglia canonica (6) + dettaglio per categoria sorgente
 *  - mappa inversa "intent → famiglie" (decision tree)
 *  - statistiche per famiglia
 *
 * Consumata dalla chat copilota del Prompt Reader prima di leggere KB
 * specifiche, e dall'omonima tab UI per ispezione umana.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const FAMILY_MAP: Record<string, string> = {
  // doctrine
  doctrine: "doctrine",
  system_doctrine: "doctrine",
  agent_doctrine: "doctrine",
  sales_doctrine: "doctrine",
  filosofia: "doctrine",
  regole_sistema: "doctrine",
  // procedures
  procedures: "procedures",
  lab_architect_procedure: "procedures",
  command_tools: "procedures",
  email_management: "procedures",
  // personas
  voice_rules: "personas",
  tono: "personas",
  calligrafia: "personas",
  chris_voss: "personas",
  // playbooks
  cold_outreach: "playbooks",
  followup: "playbooks",
  negoziazione: "playbooks",
  obiezioni: "playbooks",
  chiusura: "playbooks",
  hook: "playbooks",
  frasi_modello: "playbooks",
  struttura_email: "playbooks",
  prompt_template: "playbooks",
  arsenale: "playbooks",
  persuasione: "playbooks",
  // glossary
  errori: "glossary",
  // data-schema
  dati_partner: "data-schema",
};

const INTENT_ROUTING: Record<string, string[]> = {
  validate_identity: ["personas", "doctrine"],
  validate_objective: ["doctrine", "procedures"],
  validate_method: ["procedures", "playbooks"],
  validate_guardrail: ["doctrine", "glossary"],
  validate_output: ["playbooks"],
  improve_email: ["playbooks", "personas"],
  commercial_rule: ["doctrine", "playbooks"],
  lead_status_transition: ["doctrine", "procedures"],
  command_tool_usage: ["procedures"],
  data_schema: ["data-schema"],
  kb_intake: ["doctrine", "procedures", "personas", "playbooks", "glossary", "data-schema"],
};

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("kb_entries")
      .select("id, category, chapter, title, priority, tags")
      .eq("is_active", true);
    if (error) throw error;

    const families: Record<string, {
      family: string;
      categories: string[];
      total_entries: number;
      chapters: Record<string, number>;
      sample_titles: string[];
    }> = {};

    const allFamilies = new Set(Object.values(FAMILY_MAP));
    for (const f of allFamilies) {
      families[f] = { family: f, categories: [], total_entries: 0, chapters: {}, sample_titles: [] };
    }

    for (const e of data ?? []) {
      const cat = (e as { category: string }).category;
      const family = FAMILY_MAP[cat] ?? "other";
      if (!families[family]) {
        families[family] = { family, categories: [], total_entries: 0, chapters: {}, sample_titles: [] };
      }
      const f = families[family];
      if (!f.categories.includes(cat)) f.categories.push(cat);
      f.total_entries += 1;
      const ch = (e as { chapter: string | null }).chapter ?? "(no chapter)";
      f.chapters[ch] = (f.chapters[ch] ?? 0) + 1;
      if (f.sample_titles.length < 5) f.sample_titles.push((e as { title: string }).title);
    }

    const body = {
      generated_at: new Date().toISOString(),
      families: Object.values(families).sort((a, b) => b.total_entries - a.total_entries),
      intent_routing: INTENT_ROUTING,
      family_map: FAMILY_MAP,
      total_active_entries: (data ?? []).length,
    };

    return new Response(JSON.stringify(body), {
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=600" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
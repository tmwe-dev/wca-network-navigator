/**
 * agent-audit — Per-agent diff: DB-controlled (Prompt Lab) vs hardcoded (code).
 *
 * READ-ONLY. For each active agent returns:
 *   - persona:       DB row vs DEFAULT (none)
 *   - capabilities:  DB row vs DEFAULT_CAPABILITIES
 *   - tools:         effective whitelist vs full registry (hardcoded in agent-loop)
 *   - operative:     prompts loaded from Prompt Lab vs hardcoded fallback note
 *   - hard_guards:   always hardcoded — surfaced for transparency
 *   - system_prompt: notes which sections are hardcoded vs injected
 *
 * The diff makes it obvious to operators what they can change without
 * a redeploy (DB) versus what is locked in code.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from "../_shared/cors.ts";
import { loadOperativePrompts } from "../_shared/operativePromptsLoader.ts";
import {
  loadAgentCapabilities,
  DEFAULT_CAPABILITIES,
  READ_ONLY_TOOL_SET,
} from "../_shared/agentCapabilitiesLoader.ts";
import { loadAgentPersona } from "../_shared/agentPersonaLoader.ts";

// Mirror of agent-loop tool registry. Hardcoded source of truth.
const TOOL_REGISTRY: ReadonlyArray<{ name: string; hardcoded_approval: boolean }> = [
  { name: "navigate", hardcoded_approval: false },
  { name: "read_page", hardcoded_approval: false },
  { name: "click", hardcoded_approval: false },
  { name: "type_text", hardcoded_approval: false },
  { name: "read_dom", hardcoded_approval: false },
  { name: "list_kb", hardcoded_approval: false },
  { name: "read_kb", hardcoded_approval: false },
  { name: "scrape_url", hardcoded_approval: false },
  { name: "ask_user", hardcoded_approval: false },
  { name: "finish", hardcoded_approval: false },
  { name: "send_email", hardcoded_approval: true },
  { name: "send_whatsapp", hardcoded_approval: true },
  { name: "send_linkedin", hardcoded_approval: true },
  { name: "execute_bulk_outreach", hardcoded_approval: true },
  { name: "update_partner_status_bulk", hardcoded_approval: true },
  { name: "update_contact_status_bulk", hardcoded_approval: true },
];

// Hardcoded skeleton of system_prompt assembled by agent-loop.
// Each entry says where the section comes from.
const SYSTEM_PROMPT_SECTIONS = [
  { id: "identity_header", source: "code", note: "Frase iniziale 'Sei LUCA, direttore...' è hardcoded in agent-loop/index.ts." },
  { id: "objective", source: "runtime", note: "Iniettato dall'utente (userMessage)." },
  { id: "session_context", source: "runtime", note: "Stato pagina UI quando disponibile." },
  { id: "persona_block", source: "db:agent_personas", note: "Editabile da Prompt Lab → Personas." },
  { id: "operative_prompts", source: "db:operative_prompts", note: "Editabile da Prompt Lab → Operative." },
  { id: "tooling_footer", source: "code", note: "Istruzioni tool/ricerca varianti hardcoded in agent-loop." },
] as const;

const HARD_GUARDS = {
  source: "code:src/v2/agent/policy/hardGuards.ts",
  editable: false,
  note: "Mai modificabili da Prompt Lab. Enforcement server-side.",
  forbidden_tables: ["auth.*", "storage.*", "user_roles", "authorized_users", "vault.*", "supabase_functions.*"],
  destructive_blocked: ["DELETE", "DROP", "TRUNCATE"],
  approval_always_required: ["send_email", "send_whatsapp", "send_linkedin", "execute_bulk_outreach", "update_partner_status_bulk", "update_contact_status_bulk"],
  bulk_caps: { default: 5, hard_max: 100 },
};

function jsonResp(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface AgentRow { id: string; name: string; role: string; avatar_emoji: string | null; }

serve(async (req: Request) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    let userId: string | null = null;
    if (token) {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
      );
      const { data: { user } } = await sb.auth.getUser(token);
      if (user) userId = user.id;
    }
    if (!userId) return jsonResp({ error: "Auth richiesta" }, 401, cors);

    const supabaseSrv = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Optional: scope to single agent via ?agentId=
    const url = new URL(req.url);
    const singleAgentId = url.searchParams.get("agentId");

    let agentsQuery = supabaseSrv
      .from("agents")
      .select("id, name, role, avatar_emoji")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (singleAgentId) agentsQuery = agentsQuery.eq("id", singleAgentId);

    const { data: agentsData, error: agentsErr } = await agentsQuery;
    if (agentsErr) return jsonResp({ error: agentsErr.message }, 500, cors);
    const agents = (agentsData ?? []) as AgentRow[];

    const audits = await Promise.all(agents.map(async (agent) => {
      const persona = await loadAgentPersona(supabaseSrv, agent.id, userId!);
      const caps = await loadAgentCapabilities(supabaseSrv, agent.id);
      const lab = await loadOperativePrompts(supabaseSrv, userId!, {
        scope: "agent-loop",
        includeUniversal: true,
        limit: 5,
      });

      // Capabilities diff
      const capsDiff = diffCapabilities(caps);

      // Tool whitelist resolution
      const allTools = TOOL_REGISTRY.map((t) => t.name);
      let effectiveTools: string[];
      if (caps.executionMode === "read_only") {
        effectiveTools = allTools.filter((t) => READ_ONLY_TOOL_SET.has(t));
      } else if (caps.allowedTools.length > 0) {
        effectiveTools = allTools.filter((t) => caps.allowedTools.includes(t));
      } else {
        effectiveTools = [...allTools];
      }
      effectiveTools = effectiveTools.filter((t) => !caps.blockedTools.includes(t));

      const toolRows = TOOL_REGISTRY.map((t) => ({
        name: t.name,
        in_registry: true,
        in_allowed_list: caps.allowedTools.length === 0 || caps.allowedTools.includes(t.name),
        in_blocked_list: caps.blockedTools.includes(t.name),
        effective: effectiveTools.includes(t.name),
        approval_hardcoded: t.hardcoded_approval,
        approval_added_by_db: caps.approvalRequiredTools.includes(t.name) && !t.hardcoded_approval,
        controlled_by: t.hardcoded_approval ? "code+db" : "db",
      }));

      return {
        agent: { id: agent.id, name: agent.name, role: agent.role, avatar: agent.avatar_emoji },
        persona: {
          source: persona ? "db:agent_personas" : "code:default",
          db_loaded: !!persona,
          editable_in_prompt_lab: true,
          db_value: persona,
          hardcoded_fallback: persona ? null : "Identità di base dal prompt core (es. luca.ts).",
        },
        capabilities: {
          source: caps.loaded ? "db:agent_capabilities" : "code:DEFAULT_CAPABILITIES",
          db_loaded: caps.loaded,
          editable_in_prompt_lab: true,
          diff: capsDiff,
        },
        operative_prompts: {
          source: "db:operative_prompts",
          editable_in_prompt_lab: true,
          loaded_count: lab.matched.length,
          applied: lab.appliedNames,
          has_mandatory: lab.hasMandatory,
          hardcoded_fallback: lab.matched.length === 0
            ? "Nessun prompt operativo nel DB: l'agente userà solo l'identità + persona + tooling footer hardcoded."
            : null,
        },
        tools: {
          registry_source: "code:agent-loop/index.ts (TOOL_DEFINITIONS)",
          registry_editable: false,
          db_filter_editable: true,
          execution_mode: caps.executionMode,
          effective_count: effectiveTools.length,
          total_count: allTools.length,
          rows: toolRows,
        },
        system_prompt: {
          sections: SYSTEM_PROMPT_SECTIONS,
        },
      };
    }));

    return jsonResp({
      generated_at: new Date().toISOString(),
      hard_guards: HARD_GUARDS,
      agents: audits,
    }, 200, cors);
  } catch (e) {
    return jsonResp(
      { error: e instanceof Error ? e.message : "Errore sconosciuto" },
      500,
      cors,
    );
  }
});

/**
 * Compare loaded capabilities vs DEFAULT_CAPABILITIES, field by field.
 * Returns rows the UI can render as a clean diff table.
 */
function diffCapabilities(caps: typeof DEFAULT_CAPABILITIES) {
  const fields: Array<keyof typeof DEFAULT_CAPABILITIES> = [
    "executionMode",
    "preferredModel",
    "temperature",
    "maxTokensPerCall",
    "maxIterations",
    "maxConcurrentTools",
    "stepTimeoutMs",
    "allowedTools",
    "blockedTools",
    "approvalRequiredTools",
  ];
  return fields.map((field) => {
    const dbVal = caps[field] as unknown;
    const codeVal = DEFAULT_CAPABILITIES[field] as unknown;
    const same = JSON.stringify(dbVal) === JSON.stringify(codeVal);
    return {
      field,
      hardcoded_default: codeVal,
      db_value: dbVal,
      overridden: caps.loaded && !same,
      controlled_by: caps.loaded ? "db" : "code",
    };
  });
}
/**
 * harmonize-proposal-chat
 * Chat persistente tra l'operatore umano e l'agente Curatore (Gordon)
 * su una specifica proposta di armonizzazione.
 *
 * Estrae blocchi delimitati [REGENERATED_AFTER]…[/REGENERATED_AFTER]
 * e [SUGGEST_KB_RULE]…[/SUGGEST_KB_RULE] dalla risposta del modello,
 * persiste user+assistant nel campo chat[] della proposta dentro harmonize_runs.proposals (JSONB).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

interface ChatRow { role: "user" | "assistant"; content: string; ts?: string }

interface Proposal {
  id: string;
  action: string;
  target: { table: string; id?: string; field?: string };
  before?: string | null;
  after?: string | null;
  reasoning?: string;
  evidence?: { source?: string; excerpt?: string };
  chat?: ChatRow[];
}

function extractBlock(text: string, tag: string): string | null {
  const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, "i");
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

function buildContextMessage(p: Proposal): string {
  return [
    `# PROPOSTA SU CUI STIAMO LAVORANDO`,
    `- Azione: ${p.action}`,
    `- Tabella target: ${p.target?.table}${p.target?.field ? `.${p.target.field}` : ""}`,
    `- ID target: ${p.target?.id ?? "(nessuno)"}`,
    ``,
    `## Before (testo attuale):`,
    "```",
    p.before ?? "(vuoto)",
    "```",
    ``,
    `## After (proposta di Marco):`,
    "```",
    p.after ?? "(vuoto)",
    "```",
    ``,
    `## Reasoning di Marco:`,
    p.reasoning ?? "(nessuno)",
    ``,
    `## Evidenza (${p.evidence?.source ?? "?"}):`,
    `"${p.evidence?.excerpt ?? "(nessuna)"}"`,
  ].join("\n");
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  const headers = { ...cors, "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), { status: 405, headers });
  }

  // Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers });
  }

  try {
    const body = await req.json();
    const { run_id, proposal_id, agent_id, user_message } = body ?? {};
    if (!run_id || !proposal_id || !user_message) {
      return new Response(JSON.stringify({ error: "MISSING_FIELDS", required: ["run_id","proposal_id","user_message"] }), { status: 400, headers });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Carica Gordon (system_prompt)
    let systemPrompt = "Sei Gordon, curatore del Prompt-Lab. Rispondi in italiano semplice.";
    if (agent_id) {
      const { data: ag } = await supabase
        .from("agents")
        .select("system_prompt")
        .eq("id", agent_id)
        .maybeSingle();
      if (ag?.system_prompt) systemPrompt = ag.system_prompt as string;
    } else {
      const { data: ag } = await supabase
        .from("agents")
        .select("system_prompt")
        .eq("name", "Gordon")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (ag?.system_prompt) systemPrompt = ag.system_prompt as string;
    }

    // 2) Carica proposta dal JSONB
    const { data: runRow, error: runErr } = await supabase
      .from("harmonize_runs")
      .select("proposals")
      .eq("id", run_id)
      .maybeSingle();
    if (runErr || !runRow) {
      return new Response(JSON.stringify({ error: "RUN_NOT_FOUND" }), { status: 404, headers });
    }
    const proposals: Proposal[] = (runRow as { proposals: Proposal[] }).proposals ?? [];
    const proposal = proposals.find((p) => p.id === proposal_id);
    if (!proposal) {
      return new Response(JSON.stringify({ error: "PROPOSAL_NOT_FOUND" }), { status: 404, headers });
    }

    // 3) Costruisci messaggi
    const history: ChatRow[] = proposal.chat ?? [];
    const messages = [
      { role: "system", content: `${systemPrompt}\n\n${buildContextMessage(proposal)}` },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: String(user_message) },
    ];

    // 4) Chiama Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI_NOT_CONFIGURED" }), { status: 500, headers });
    }
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages, stream: false }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "RATE_LIMIT", message: "Troppe richieste, riprova tra un minuto." }), { status: 429, headers });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "CREDITS_EXHAUSTED", message: "Crediti AI esauriti, ricarica il workspace." }), { status: 402, headers });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI_GATEWAY_ERROR", status: aiRes.status }), { status: 502, headers });
    }

    const aiJson = await aiRes.json();
    const reply: string = aiJson?.choices?.[0]?.message?.content ?? "";

    // 5) Estrai blocchi speciali
    const regeneratedAfter = extractBlock(reply, "REGENERATED_AFTER");
    const suggestedRuleRaw = extractBlock(reply, "SUGGEST_KB_RULE");
    let suggestedRule: { title: string; content: string } | null = null;
    if (suggestedRuleRaw) {
      const titleMatch = suggestedRuleRaw.match(/titolo:\s*(.+)/i);
      const contentMatch = suggestedRuleRaw.match(/contenuto:\s*([\s\S]+)/i);
      suggestedRule = {
        title: titleMatch?.[1]?.trim() ?? "Regola da Gordon",
        content: contentMatch?.[1]?.trim() ?? suggestedRuleRaw,
      };
    }

    // Reply pulito (senza blocchi tecnici) per la chat visibile
    const cleanReply = reply
      .replace(/\[REGENERATED_AFTER\][\s\S]*?\[\/REGENERATED_AFTER\]/gi, "_(ho preparato un nuovo testo, vedi sotto ↓)_")
      .replace(/\[SUGGEST_KB_RULE\][\s\S]*?\[\/SUGGEST_KB_RULE\]/gi, "_(ti propongo di salvarla come regola permanente, vedi sotto ↓)_")
      .trim();

    // 6) Persisti chat
    const ts = new Date().toISOString();
    const updatedChat: ChatRow[] = [
      ...history,
      { role: "user", content: String(user_message), ts },
      { role: "assistant", content: cleanReply || reply, ts },
    ];
    const updatedProposals = proposals.map((p) =>
      p.id === proposal_id ? { ...p, chat: updatedChat } : p,
    );
    await supabase
      .from("harmonize_runs")
      .update({ proposals: updatedProposals })
      .eq("id", run_id);

    return new Response(JSON.stringify({
      reply: cleanReply || reply,
      regenerated_after: regeneratedAfter,
      suggested_rule: suggestedRule,
    }), { status: 200, headers });
  } catch (error: unknown) {
    console.error("harmonize-proposal-chat error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR", message: msg }), { status: 500, headers });
  }
});
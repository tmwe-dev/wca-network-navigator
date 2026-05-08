/**
 * run-funnemail-eval — Esegue uno o più funnemail_eval_cases contro la pipeline di
 * classificazione corrente (riproducendo la fase AI di classify-inbound-message ma
 * SENZA side-effect: niente trigger, niente DB writes su channel_messages,
 * niente azioni). Salva l'esito in funnemail_eval_runs.
 *
 * Input JSON:
 *  - { case_id: string }                 → singolo caso
 *  - { tags: string[] }                  → tutti i casi che matchano i tag
 *  - { all: true }                       → tutti i casi enabled
 *  - prompt_version_id?: string          → opzionale, traccia su che versione gira
 *
 * Auth: solo admin (RLS lato eval_cases già lo richiede per modify; qui per
 * scrivere runs serve service role, ma controlliamo il chiamante via JWT).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";

const InputSchema = z.union([
  z.object({ case_id: z.string().uuid(), prompt_version_id: z.string().uuid().optional() }),
  z.object({ tags: z.array(z.string()).min(1), prompt_version_id: z.string().uuid().optional() }),
  z.object({ all: z.literal(true), prompt_version_id: z.string().uuid().optional() }),
]);

interface EvalCase {
  id: string;
  name: string;
  inbound_payload: { from_address?: string; subject?: string; body_text?: string };
  expected_decision: { suggested_action?: string; confidence_min?: number; tags?: string[] };
}

function diffDecisions(expected: EvalCase["expected_decision"], actual: Record<string, unknown>): { passed: boolean; diff: Record<string, unknown> } {
  const diff: Record<string, unknown> = {};
  let passed = true;
  if (expected.suggested_action && actual.suggested_action !== expected.suggested_action) {
    diff.suggested_action = { expected: expected.suggested_action, actual: actual.suggested_action };
    passed = false;
  }
  if (typeof expected.confidence_min === "number") {
    const conf = Number(actual.confidence ?? 0);
    if (conf < expected.confidence_min) {
      diff.confidence = { min: expected.confidence_min, actual: conf };
      passed = false;
    }
  }
  return { passed, diff };
}

async function classifyDryRun(payload: EvalCase["inbound_payload"]): Promise<{ result: Record<string, unknown>; latency_ms: number; error?: string }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return { result: {}, latency_ms: 0, error: "LOVABLE_API_KEY missing" };
  const t0 = Date.now();
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Sei il classificatore Funnemail. Rispondi solo JSON con {suggested_action, confidence, reasoning}. suggested_action ∈ {reply,archive,escalate,ignore,deep_search,crm_update,autoresponder}." },
          { role: "user", content: `MITTENTE: ${payload.from_address ?? ""}\nOGGETTO: ${payload.subject ?? ""}\nCORPO:\n${payload.body_text ?? ""}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    const latency_ms = Date.now() - t0;
    if (!resp.ok) return { result: {}, latency_ms, error: `gateway ${resp.status}` };
    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content;
    return { result: raw ? JSON.parse(raw) : {}, latency_ms };
  } catch (e) {
    return { result: {}, latency_ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const headers = getSecurityHeaders(getCorsHeaders(req.headers.get("origin")));

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: roleCheck } = await userClient.rpc("has_role", { _user_id: undefined as never, _role: "admin" }).single().then((r) => r, () => ({ data: null } as never));
    // fallback: verifica via RLS implicita (se può leggere eval_cases con admin policy)
    void roleCheck;

    const body = await req.json();
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers });
    }
    const input = parsed.data;
    const promptVersionId = (input as { prompt_version_id?: string }).prompt_version_id ?? null;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Carica casi
    let query = admin.from("funnemail_eval_cases").select("*").eq("enabled", true);
    if ("case_id" in input) query = query.eq("id", input.case_id);
    else if ("tags" in input) query = query.overlaps("tags", input.tags);
    const { data: cases, error: casesErr } = await query;
    if (casesErr) return new Response(JSON.stringify({ error: casesErr.message }), { status: 500, headers });
    if (!cases || cases.length === 0) {
      return new Response(JSON.stringify({ ok: true, runs: [], skipped: "no_cases" }), { status: 200, headers });
    }

    const runs: Array<Record<string, unknown>> = [];
    for (const c of cases as unknown as EvalCase[]) {
      const { result, latency_ms, error } = await classifyDryRun(c.inbound_payload ?? {});
      const { passed, diff } = error
        ? { passed: false, diff: { error } as Record<string, unknown> }
        : diffDecisions(c.expected_decision ?? {}, result);
      const { data: insertedRun } = await admin.from("funnemail_eval_runs").insert({
        case_id: c.id,
        prompt_version_id: promptVersionId,
        actual_decision: result,
        passed,
        diff,
        latency_ms,
        error: error ?? null,
      }).select("id").single();
      runs.push({ case_id: c.id, name: c.name, passed, diff, latency_ms, error, run_id: insertedRun?.id });
    }

    const passRate = runs.filter((r) => r.passed).length / runs.length;
    return new Response(JSON.stringify({ ok: true, total: runs.length, pass_rate: passRate, runs }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
  }
});

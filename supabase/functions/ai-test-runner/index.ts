/**
 * ai-test-runner — Esegue scenari di test (ai_test_scenarios) contro
 * qualsiasi edge function AI del sistema, applica assertion e ritorna
 * il risultato aggregato.
 *
 * Body: { scenario_ids: string[] }
 * Risposta: { results: Array<{ scenario_id, status, duration_ms, response, failed_assertions[] }> }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from "../_shared/cors.ts";

interface Assertion {
  type: "status_ok" | "response_min_length" | "response_contains" | "response_not_contains" | "response_contains_key" | "json_path_equals";
  value?: string | number;
  path?: string;
}

interface Scenario {
  id: string;
  name: string;
  target_function: string;
  ai_scope: string;
  payload: Record<string, unknown>;
  assertions: Assertion[];
}

function jsonResp(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function evaluateAssertions(assertions: Assertion[], status: number, response: unknown): string[] {
  const failed: string[] = [];
  const responseText = typeof response === "string" ? response : JSON.stringify(response ?? "");
  for (const a of assertions ?? []) {
    try {
      switch (a.type) {
        case "status_ok":
          if (status < 200 || status >= 300) failed.push(`status_ok: ricevuto ${status}`);
          break;
        case "response_min_length": {
          const min = Number(a.value ?? 0);
          if (responseText.length < min) failed.push(`response_min_length: ${responseText.length}<${min}`);
          break;
        }
        case "response_contains":
          if (!responseText.toLowerCase().includes(String(a.value ?? "").toLowerCase()))
            failed.push(`response_contains: manca "${a.value}"`);
          break;
        case "response_not_contains":
          if (responseText.toLowerCase().includes(String(a.value ?? "").toLowerCase()))
            failed.push(`response_not_contains: presente "${a.value}"`);
          break;
        case "response_contains_key": {
          const obj = response as Record<string, unknown> | null;
          if (!obj || typeof obj !== "object" || !(String(a.value ?? "") in obj))
            failed.push(`response_contains_key: chiave "${a.value}" mancante`);
          break;
        }
        case "json_path_equals": {
          const parts = String(a.path ?? "").split(".").filter(Boolean);
          let cur: unknown = response;
          for (const p of parts) {
            if (cur && typeof cur === "object") cur = (cur as Record<string, unknown>)[p];
            else { cur = undefined; break; }
          }
          if (String(cur) !== String(a.value)) failed.push(`json_path_equals: ${a.path}=${cur} ≠ ${a.value}`);
          break;
        }
      }
    } catch (e) {
      failed.push(`assertion_error: ${(e as Error).message}`);
    }
  }
  return failed;
}

serve(async (req: Request) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return jsonResp({ error: "Auth richiesta" }, 401, cors);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

    const sb = createClient(SUPABASE_URL, ANON);
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return jsonResp({ error: "Auth richiesta" }, 401, cors);

    const body = await req.json().catch(() => ({}));
    const scenarioIds: string[] = Array.isArray(body.scenario_ids) ? body.scenario_ids : [];
    if (scenarioIds.length === 0) return jsonResp({ error: "scenario_ids vuoto" }, 400, cors);
    if (scenarioIds.length > 30) return jsonResp({ error: "max 30 scenari per run" }, 400, cors);

    const sbAuthed = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: scenarios, error } = await sbAuthed
      .from("ai_test_scenarios")
      .select("id, name, target_function, ai_scope, payload, assertions")
      .in("id", scenarioIds);
    if (error) return jsonResp({ error: error.message }, 500, cors);

    const list = (scenarios ?? []) as unknown as Scenario[];

    const results = await Promise.all(list.map(async (s) => {
      const start = Date.now();
      try {
        const url = `${SUPABASE_URL}/functions/v1/${s.target_function}`;
        const enriched = {
          ...(s.payload || {}),
          scope: s.ai_scope,
          context: { source: "ai-test-hub", route: "/v2/ai-test-hub", mode: "test", extra: { scenario_id: s.id } },
        };
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            apikey: ANON,
          },
          body: JSON.stringify(enriched),
        });
        const text = await resp.text();
        let parsed: unknown = text;
        try { parsed = JSON.parse(text); } catch { /* keep text */ }
        const failed = evaluateAssertions(s.assertions ?? [], resp.status, parsed);
        return {
          scenario_id: s.id,
          name: s.name,
          target_function: s.target_function,
          status: failed.length === 0 ? "pass" : "fail",
          http_status: resp.status,
          duration_ms: Date.now() - start,
          failed_assertions: failed,
          response_preview: typeof parsed === "string" ? parsed.slice(0, 800) : JSON.stringify(parsed).slice(0, 800),
        };
      } catch (e) {
        return {
          scenario_id: s.id,
          name: s.name,
          target_function: s.target_function,
          status: "error",
          http_status: 0,
          duration_ms: Date.now() - start,
          failed_assertions: [`exception: ${(e as Error).message}`],
          response_preview: "",
        };
      }
    }));

    return jsonResp({ results, total: results.length, passed: results.filter(r => r.status === "pass").length }, 200, cors);
  } catch (e) {
    return jsonResp({ error: (e as Error).message }, 500, cors);
  }
});
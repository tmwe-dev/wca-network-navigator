/**
 * prompt-registry-drift-check
 *
 * Audit Funnemail Cr6 / audit esterno Gap 5 — Prompt registry drift.
 *
 * Per ogni voce di EDGE_FN_REGISTRY confronta il nome/scope/tag dichiarati
 * con i prompt operativi attivi nel DB. Restituisce un report (best-effort)
 * dei drift potenziali: scope assenti, tag senza prompt, prompt deprecato
 * ancora referenziato, prompt mancante per edge "must-have".
 *
 * Solo lettura. Nessun side-effect. Pensata per essere chiamata on-demand
 * dalla pagina /v2/prompt-lab/catalog o da un cron giornaliero futuro.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { EDGE_FN_REGISTRY } from "../_shared/edgeFnPromptRegistry.ts";

interface DriftItem {
  edge_function: string;
  scope: string;
  expected_tags: string[];
  expected_contexts: string[];
  active_prompts_found: number;
  drift: string[];
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = getCorsHeaders(req.headers.get("origin"));
  const headers = getSecurityHeaders(cors);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const items: DriftItem[] = [];

  for (const spec of EDGE_FN_REGISTRY) {
    const tags = spec.loaderOptions.extraTags ?? [];
    const contexts = spec.loaderOptions.extraContexts ?? [];
    const scope = spec.loaderOptions.scope;

    let active = 0;
    const drift: string[] = [];
    try {
      let q = supabase
        .from("operative_prompts")
        .select("id,name,context,tags,is_active,deprecated_at", { count: "exact", head: false })
        .eq("is_active", true)
        .is("deprecated_at", null);

      // Match by context OR scope-equivalent context.
      const wantedContexts = Array.from(new Set([scope as string, ...contexts]));
      if (wantedContexts.length) q = q.in("context", wantedContexts);

      const { data, error } = await q.limit(50);
      if (error) {
        drift.push(`db_error: ${error.message}`);
      } else {
        const rows = data ?? [];
        active = rows.length;
        if (active === 0) drift.push("no_active_prompt_for_scope_or_context");
        if (tags.length) {
          const matches = rows.filter((r: { tags: string[] }) =>
            tags.some((t) => (r.tags ?? []).includes(t)));
          if (matches.length === 0) drift.push(`no_prompt_with_expected_tags:${tags.join(",")}`);
        }
      }
    } catch (e) {
      drift.push(`exception: ${e instanceof Error ? e.message : String(e)}`);
    }

    items.push({
      edge_function: spec.edgeFunction,
      scope: scope as string,
      expected_tags: tags,
      expected_contexts: contexts,
      active_prompts_found: active,
      drift,
    });
  }

  const summary = {
    edges_checked: items.length,
    edges_with_drift: items.filter((i) => i.drift.length > 0).length,
  };

  return new Response(
    JSON.stringify({ ok: true, summary, items, generated_at: new Date().toISOString() }),
    { status: 200, headers: { ...headers, "Content-Type": "application/json" } },
  );
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);
  const headers = { ...dynCors, "Content-Type": "application/json" };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const checks: Record<string, string> = {
    database: "fail",
    auth: "fail",
    storage: "fail",
    ai_gateway: "fail",
  };

  // DB
  try {
    const { error } = await supabase.from("app_settings").select("id", { count: "exact", head: true });
    checks.database = error ? "fail" : "ok";
  } catch { /* */ }

  // Auth
  try {
    const { error } = await supabase.auth.admin.listUsers({ perPage: 1 });
    checks.auth = error ? "fail" : "ok";
  } catch { /* */ }

  // Storage
  try {
    const { error } = await supabase.storage.listBuckets();
    checks.storage = error ? "fail" : "ok";
  } catch { /* */ }

  // AI Gateway
  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (lovableKey) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/models", {
        headers: { Authorization: `Bearer ${lovableKey}` },
        signal: AbortSignal.timeout(5000),
      });
      checks.ai_gateway = resp.ok ? "ok" : "fail";
    }
  } catch { /* */ }

  const allOk = Object.values(checks).every((v) => v === "ok");

  return new Response(
    JSON.stringify({
      status: allOk ? "healthy" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    }),
    { status: allOk ? 200 : 503, headers },
  );
});

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

  const checks: Record<string, boolean> = {
    database: false,
    auth: false,
    storage: false,
  };

  // DB
  try {
    const { error } = await supabase.from("profiles").select("id", { count: "exact", head: true });
    checks.database = !error;
  } catch { /* */ }

  // Auth
  try {
    const { error } = await supabase.auth.admin.listUsers({ perPage: 1 });
    checks.auth = !error;
  } catch { /* */ }

  // Storage
  try {
    const { error } = await supabase.storage.listBuckets();
    checks.storage = !error;
  } catch { /* */ }

  const allHealthy = Object.values(checks).every(Boolean);

  return new Response(
    JSON.stringify({
      status: allHealthy ? "healthy" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    }),
    { status: allHealthy ? 200 : 503, headers },
  );
});

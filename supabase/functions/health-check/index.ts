import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);
  const headers = getSecurityHeaders(dynCors);

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
  const overallStatus = allOk ? "healthy" : "degraded";

  // Webhook alerting on degraded status
  if (overallStatus === "degraded") {
    try {
      const { data: alertConfigs } = await supabase
        .from("alert_config")
        .select("*")
        .eq("enabled", true)
        .eq("alert_on_degraded", true);

      for (const config of alertConfigs || []) {
        // Check cooldown
        if (config.last_alert_at) {
          const cooldown = (config.cooldown_minutes || 15) * 60 * 1000;
          if (Date.now() - new Date(config.last_alert_at).getTime() < cooldown) continue;
        }

        // Send webhook alert
        if (config.webhook_url) {
          await fetch(config.webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: `⚠️ WCA Navigator Health Alert: Status ${overallStatus}`,
              checks,
              timestamp: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(5000),
          }).catch(() => {});
        }

        // Update last alert timestamp
        await supabase
          .from("alert_config")
          .update({ last_alert_at: new Date().toISOString() })
          .eq("id", config.id);
      }
    } catch { /* fire and forget */ }
  }

  return new Response(
    JSON.stringify({
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
    }),
    { status: allOk ? 200 : 503, headers },
  );
});

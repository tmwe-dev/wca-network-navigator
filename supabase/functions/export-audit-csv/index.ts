/**
 * export-audit-csv edge function — Exports agent_action_log as CSV.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    // Auth
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
    );
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Non autenticato" }), {
        status: 401,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // Query params
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get("days") ?? "30", 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const serviceSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: logs, error: qErr } = await serviceSb
      .from("agent_action_log")
      .select("id, user_id, conversation_id, tool_name, args, result, created_at")
      .eq("user_id", user.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (qErr) {
      return new Response(JSON.stringify({ error: qErr.message }), {
        status: 500,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const rows = (logs ?? []) as Array<Record<string, unknown>>;

    // Build CSV
    const headers = ["id", "user_id", "conversation_id", "tool_name", "args", "result", "created_at"];
    const csvLines = [
      headers.join(","),
      ...rows.map((r) =>
        headers.map((h) => {
          const val = r[h];
          const str = typeof val === "object" ? JSON.stringify(val) : String(val ?? "");
          return `"${str.replace(/"/g, '""')}"`;
        }).join(",")
      ),
    ];

    return new Response(csvLines.join("\n"), {
      status: 200,
      headers: {
        ...dynCors,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit_log_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});

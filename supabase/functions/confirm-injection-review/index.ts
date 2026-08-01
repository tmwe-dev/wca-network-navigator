/**
 * confirm-injection-review — Edge function per approvare/rifiutare un prompt
 * sospetto rilevato dal guard anti-injection.
 *
 * POST body:
 *   { review_id: string, decision: "approved" | "rejected", reason?: string }
 *
 * Risposta:
 *   { ok: true, review_id, status }
 *
 * RLS:
 *   La policy `pir_update_own` consente UPDATE solo a user_id corrispondente
 *   (o admin). Usiamo il client autenticato dell'utente, NON service-role.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { resolveInjectionReview } from "../_shared/injectionGuard.ts";

interface ReqBody {
  review_id?: string;
  decision?: "approved" | "rejected";
  reason?: string;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const corsH = getCorsHeaders(req.headers.get("origin"));
  const headers = getSecurityHeaders(corsH);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }

  const { review_id, decision, reason } = body;
  if (!review_id || (decision !== "approved" && decision !== "rejected")) {
    return new Response(
      JSON.stringify({ error: "review_id and decision (approved|rejected) required" }),
      { status: 400, headers },
    );
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers });
  }

  // Client autenticato per rispettare RLS (solo l'owner può approvare).
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  // Decode JWT per ottenere user id (no network call).
  let userId: string | null = null;
  try {
    const token = authHeader.slice(7);
    const payload = JSON.parse(atob(token.split(".")[1]));
    userId = payload.sub ?? null;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers });
  }
  if (!userId) {
    return new Response(JSON.stringify({ error: "Invalid token (no sub)" }), { status: 401, headers });
  }

  const result = await resolveInjectionReview(supabase, review_id, decision, userId, reason);
  if (!result.ok) {
    return new Response(
      JSON.stringify({ error: result.error ?? "update failed" }),
      { status: 400, headers },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, review_id, status: decision }),
    { status: 200, headers },
  );
});

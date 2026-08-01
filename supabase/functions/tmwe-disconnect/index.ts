/**
 * tmwe-disconnect — Rimuove la connessione TMWE per l'operatore corrente.
 */
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import { serviceClient } from "../_shared/tmweClient.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const corsH = getCorsHeaders(origin);
  const headers = getSecurityHeaders(corsH);

  try {
    const auth = await requireAuth(req, corsH);
    if (isAuthError(auth)) return auth;

    const svc = serviceClient();
    const { error } = await svc
      .from("tmwe_user_tokens")
      .delete()
      .eq("user_id", auth.userId);
    if (error) {
      return new Response(
        JSON.stringify({ error: error.message, code: "INTERNAL_ERROR" }),
        { status: 500, headers },
      );
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message, code: "INTERNAL_ERROR" }),
      { status: 500, headers },
    );
  }
});
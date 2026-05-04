/**
 * tmwe-oauth-start — Crea state CSRF e restituisce l'URL di autorizzazione TMWE.
 * La UI fa redirect a `redirect_url`. Nessun token viene mai esposto al client.
 */
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import { serviceClient } from "../_shared/tmweClient.ts";

const DEFAULT_SCOPES =
  "profile:read shipment:read shipment:write tracking:read document:read";

function randomState(): string {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const corsH = getCorsHeaders(origin);
  const headers = getSecurityHeaders(corsH);

  try {
    // Parse body to detect intent (default: connect)
    let intent: "connect" | "login" = "connect";
    try {
      const body = await req.json();
      if (body?.intent === "login") intent = "login";
    } catch {
      // no body — keep default
    }

    let userId: string | null = null;
    if (intent === "connect") {
      const auth = await requireAuth(req, corsH);
      if (isAuthError(auth)) return auth;
      userId = auth.userId;
    }

    const svc = serviceClient();
    const state = randomState();
    const { error: insErr } = await svc.from("tmwe_oauth_state").insert({
      state,
      user_id: userId,
      intent,
    });
    if (insErr) {
      return new Response(
        JSON.stringify({ error: insErr.message, code: "INTERNAL_ERROR" }),
        { status: 500, headers },
      );
    }

    const base = (Deno.env.get("TMWE_BASE_URL") ?? "https://sandbox.findair.net").replace(/\/+$/, "");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: Deno.env.get("TMWE_OAUTH_CLIENT_ID")!,
      redirect_uri: Deno.env.get("TMWE_OAUTH_REDIRECT_URI")!,
      scope: DEFAULT_SCOPES,
      state,
    });
    // Per TMWE API spec: /authorization redirige a /auth se l'utente non è
    // autenticato. In pratica /authorization restituisce 405 quando aperto
    // direttamente dal browser (richiede sessione), quindi puntiamo
    // direttamente a /auth (login form) che gestisce l'intero flusso
    // Authorization Code: GET → form, POST → 302 al redirect_uri con `code`.
    const redirectUrl = `${base}/erp/tmwe_json/auth?${params.toString()}`;

    return new Response(JSON.stringify({ redirect_url: redirectUrl, state }), {
      status: 200,
      headers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message, code: "INTERNAL_ERROR" }),
      { status: 500, headers },
    );
  }
});
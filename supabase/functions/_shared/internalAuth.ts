/**
 * internalAuth — guard server-to-server per orchestrazioni Funnemail.
 *
 * Pattern: ammette UNA delle due:
 *  1. JWT utente valido (Authorization: Bearer <jwt>) → ritorna { kind: "user", userId, jwt }
 *  2. Token interno server-to-server (header `x-internal-token` === SUPABASE_SERVICE_ROLE_KEY)
 *     → ritorna { kind: "internal", userId: body.user_id ?? null }
 *
 * Il service_role key è già un secret server-side mai esposto al client,
 * quindi non serve un secret addizionale: edge → edge possono firmarsi
 * con questo header senza bisogno di JWT utente (caso orchestratore).
 *
 * Uso:
 *   const auth = await requireInternalOrUser(req, body.user_id);
 *   if (auth.kind === "error") return auth.response;
 *   const userId = auth.userId; // potenzialmente null se internal
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type InternalOrUserAuth =
  | { kind: "user"; userId: string; jwt: string }
  | { kind: "internal"; userId: string | null }
  | { kind: "error"; response: Response };

const INTERNAL_HEADER = "x-internal-token";

function unauthorized(headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export async function requireInternalOrUser(
  req: Request,
  fallbackUserId: string | null | undefined,
  responseHeaders: Record<string, string> = {},
): Promise<InternalOrUserAuth> {
  const internalToken = req.headers.get(INTERNAL_HEADER);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // Path 1: token interno (orchestratore edge → edge)
  if (internalToken && serviceKey && internalToken === serviceKey) {
    return { kind: "internal", userId: fallbackUserId ?? null };
  }

  // Path 2: JWT utente
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return { kind: "error", response: unauthorized(responseHeaders) };
  }
  const jwt = authHeader.slice(7).trim();
  if (!jwt) {
    return { kind: "error", response: unauthorized(responseHeaders) };
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data, error } = await supabase.auth.getClaims(jwt);
    if (error || !data?.claims?.sub) {
      return { kind: "error", response: unauthorized(responseHeaders) };
    }
    return { kind: "user", userId: data.claims.sub as string, jwt };
  } catch (_e) {
    return { kind: "error", response: unauthorized(responseHeaders) };
  }
}

/** Header da iniettare quando si chiama un'altra edge come orchestratore. */
export function buildInternalAuthHeaders(): Record<string, string> {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return key ? { [INTERNAL_HEADER]: key } : {};
}
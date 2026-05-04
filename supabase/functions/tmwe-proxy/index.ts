/**
 * tmwe-proxy — Unico canale di uscita verso TMWE Findair.
 *
 * Il client invoca { op, params, identity? } dove `op` deve essere presente
 * nella whitelist TMWE_OPS. I token TMWE non escono mai dall'edge runtime.
 */
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import {
  TMWE_OPS,
  type TmweOpName,
  serviceClient,
  getSystemToken,
  getUserToken,
  callTmwe,
  auditCall,
} from "../_shared/tmweClient.ts";

interface ProxyBody {
  op?: string;
  params?: Record<string, unknown>;
  identity?: "user" | "system";
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const corsH = getCorsHeaders(origin);
  const headers = getSecurityHeaders(corsH);

  try {
    const auth = await requireAuth(req, corsH);
    if (isAuthError(auth)) return auth;

    const limit = checkRateLimit(`tmwe-proxy:${auth.userId}`, {
      maxTokens: 60,
      refillRate: 1,
      windowMs: 60_000,
    });
    if (!limit.allowed) return rateLimitResponse(limit, corsH);

    const body = (await req.json().catch(() => ({}))) as ProxyBody;
    const opName = body.op as TmweOpName | undefined;
    if (!opName || !(opName in TMWE_OPS)) {
      return new Response(
        JSON.stringify({ error: "UNKNOWN_OP", code: "VALIDATION_ERROR" }),
        { status: 400, headers },
      );
    }
    const op = TMWE_OPS[opName];
    const identity = body.identity ?? op.identity;
    if (identity !== op.identity) {
      return new Response(
        JSON.stringify({ error: "IDENTITY_MISMATCH", code: "VALIDATION_ERROR" }),
        { status: 400, headers },
      );
    }

    const svc = serviceClient();
    const startedAt = Date.now();
    let bearer: string;
    let tmweUserId: number | null = null;

    if (identity === "system") {
      bearer = await getSystemToken(svc);
    } else {
      const rec = await getUserToken(svc, auth.userId);
      if (!rec) {
        await auditCall(svc, {
          user_id: auth.userId,
          tmwe_user_id: null,
          op: opName,
          identity,
          status_code: 412,
          latency_ms: Date.now() - startedAt,
          error: "TMWE_NOT_CONNECTED",
        });
        return new Response(
          JSON.stringify({ error: "TMWE_NOT_CONNECTED", code: "NOT_FOUND" }),
          { status: 412, headers },
        );
      }
      bearer = rec.access_token;
      tmweUserId = rec.tmwe_user_id;
    }

    const result = await callTmwe(op, bearer, body.params);

    if (identity === "user" && tmweUserId !== null) {
      // best-effort last_used_at
      svc
        .from("tmwe_user_tokens")
        .update({ last_used_at: new Date().toISOString() })
        .eq("user_id", auth.userId)
        .then(() => undefined);
    }

    await auditCall(svc, {
      user_id: auth.userId,
      tmwe_user_id: tmweUserId,
      op: opName,
      identity,
      status_code: result.status,
      latency_ms: Date.now() - startedAt,
      error: result.ok ? null : "UPSTREAM_ERROR",
    });

    return new Response(
      JSON.stringify({
        ok: result.ok,
        status: result.status,
        data: result.data,
        tmwe_user_id: tmweUserId,
      }),
      { status: result.ok ? 200 : 502, headers },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message, code: "INTERNAL_ERROR" }),
      { status: 500, headers },
    );
  }
});
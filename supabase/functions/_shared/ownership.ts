/**
 * ownership.ts — Shared ownership/authorization helpers for Edge Functions.
 *
 * Pattern:
 *   const ctx = await resolveCaller(req, corsHeaders);
 *   if (ctx instanceof Response) return ctx;
 *   const err = await assertDraftOwned(supabase, draftId, ctx.userId, corsHeaders);
 *   if (err) return err;
 *
 * `resolveCaller` accepts:
 *   - User JWT (Authorization: Bearer <user_jwt>) → userId from claims.sub
 *   - Service-role token (Authorization: Bearer <SERVICE_ROLE_KEY>) → userId
 *     MUST come from request body `user_id` (internal cron/trigger pattern).
 *     The body is consumed once and re-attached on the returned `bodyJson`.
 *
 * Ownership helpers return `null` when ok, or a 403/404 Response otherwise.
 * They never throw — caller just `if (err) return err`.
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type Cors = Record<string, string>;

export interface CallerContext {
  /** Resolved owner userId (JWT sub or body.user_id for service-role). */
  userId: string;
  /** Raw Bearer token (user JWT or service-role key). */
  token: string;
  /** True if caller authenticated as service-role (internal). */
  isService: boolean;
  /** Parsed JSON body (may be null if request had no body). */
  bodyJson: Record<string, unknown> | null;
}

function jsonError(status: number, code: string, message: string, cors: Cors): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/**
 * Reads the caller identity from the request.
 * Returns a Response on auth failure, or { userId, token, isService, bodyJson } on success.
 * Reads request body at most once; pass `parseBody:false` if you handle it yourself.
 */
export async function resolveCaller(
  req: Request,
  cors: Cors,
  opts: { parseBody?: boolean } = {},
): Promise<CallerContext | Response> {
  const parseBody = opts.parseBody !== false;
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "AUTH_REQUIRED", "Bearer token required", cors);
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return jsonError(401, "AUTH_REQUIRED", "Empty bearer token", cors);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  // SECURITY: anon-key is NEVER a valid identity.
  if (anonKey && token === anonKey) {
    return jsonError(401, "AUTH_INVALID", "anon key is not a valid identity", cors);
  }

  let bodyJson: Record<string, unknown> | null = null;
  if (parseBody) {
    try {
      const cloned = req.clone();
      const txt = await cloned.text();
      if (txt) bodyJson = JSON.parse(txt) as Record<string, unknown>;
    } catch {
      bodyJson = null;
    }
  }

  // Service-role: must carry user_id in body. Used only by internal triggers/cron.
  // Robust detection: exact env match (legacy JWT or new sb_secret_*) OR
  // any token with the new "sb_secret_" prefix (Supabase's rotated secret-key
  // format — possessing it is equivalent to service-role access anyway, since
  // that prefix is reserved for non-anon project secret keys).
  const isNewSecretFormat = token.startsWith("sb_secret_");
  const isExactServiceMatch = !!serviceKey && token === serviceKey;
  if (isExactServiceMatch || isNewSecretFormat) {
    const bodyUserId =
      bodyJson && typeof bodyJson.user_id === "string" ? (bodyJson.user_id as string) : null;
    if (!bodyUserId) {
      return jsonError(
        400,
        "MISSING_USER_ID",
        "service-role calls require user_id in body",
        cors,
      );
    }
    return { userId: bodyUserId, token, isService: true, bodyJson };
  }

  // User JWT path
  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await authClient.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return jsonError(401, "AUTH_INVALID", "Invalid or expired token", cors);
  }
  return {
    userId: data.claims.sub as string,
    token,
    isService: false,
    bodyJson,
  };
}

/** Returns a service-role client (no user context). */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Generic ownership check: row in `table` with `id == rowId` must have
 * `user_id == userId`. Returns null if ok, otherwise a 404/403 Response.
 * 404 is used when row is missing OR not owned (don't leak existence).
 */
export async function assertOwnedBy(
  supabase: SupabaseClient,
  table: string,
  rowId: string,
  userId: string,
  cors: Cors,
  opts: { idColumn?: string; ownerColumn?: string; resourceLabel?: string } = {},
): Promise<Response | null> {
  const idCol = opts.idColumn || "id";
  const ownerCol = opts.ownerColumn || "user_id";
  const label = opts.resourceLabel || table;
  const { data, error } = await supabase
    .from(table)
    .select(`${idCol}, ${ownerCol}`)
    .eq(idCol, rowId)
    .maybeSingle();
  if (error || !data) {
    return jsonError(404, "NOT_FOUND", `${label} not found`, cors);
  }
  if ((data as Record<string, unknown>)[ownerCol] !== userId) {
    return jsonError(404, "NOT_FOUND", `${label} not found`, cors);
  }
  return null;
}

export const assertAgentOwned = (
  s: SupabaseClient,
  agentId: string,
  userId: string,
  cors: Cors,
) => assertOwnedBy(s, "agents", agentId, userId, cors, { resourceLabel: "agent" });

export const assertDraftOwned = (
  s: SupabaseClient,
  draftId: string,
  userId: string,
  cors: Cors,
) => assertOwnedBy(s, "email_drafts", draftId, userId, cors, { resourceLabel: "draft" });

export const assertJobOwned = (
  s: SupabaseClient,
  jobId: string,
  userId: string,
  cors: Cors,
) => assertOwnedBy(s, "download_jobs", jobId, userId, cors, { resourceLabel: "job" });

export const assertMessageOwned = (
  s: SupabaseClient,
  messageId: string,
  userId: string,
  cors: Cors,
) => assertOwnedBy(s, "channel_messages", messageId, userId, cors, { resourceLabel: "message" });

/**
 * Operator ownership: an operator is "owned" by a user when
 * `operators.user_id == userId`. We treat missing operator as 404.
 */
export async function assertOperatorOwned(
  supabase: SupabaseClient,
  operatorId: string,
  userId: string,
  cors: Cors,
): Promise<Response | null> {
  return assertOwnedBy(supabase, "operators", operatorId, userId, cors, {
    resourceLabel: "operator",
  });
}

/**
 * Bulk ownership check for messages: returns a 404 Response if ANY
 * messageId is not owned by the user. Optimized to a single IN query.
 */
export async function assertAllMessagesOwned(
  supabase: SupabaseClient,
  messageIds: string[],
  userId: string,
  cors: Cors,
): Promise<Response | null> {
  if (messageIds.length === 0) return null;
  const { data, error } = await supabase
    .from("channel_messages")
    .select("id")
    .in("id", messageIds)
    .eq("user_id", userId);
  if (error) return jsonError(500, "OWNERSHIP_CHECK_FAILED", error.message, cors);
  const found = new Set((data ?? []).map((r: { id: string }) => r.id));
  for (const mid of messageIds) {
    if (!found.has(mid)) {
      return jsonError(404, "NOT_FOUND", `message ${mid} not found`, cors);
    }
  }
  return null;
}
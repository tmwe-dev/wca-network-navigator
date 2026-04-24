// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTHENTICATION & AUTHORIZATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface AuthContext {
  userId: string;
  authHeader: string;
  authClient: ReturnType<typeof createClient>;
}

/**
 * Extract and validate user authentication from request headers
 */
export async function authenticateRequest(
  req: Request,
  dynCors: Record<string, string>
): Promise<{ auth: AuthContext; error?: Response }> {
  const authHeader = req.headers.get("Authorization") || "";
  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  let userId: string;
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");

    // Service-role bypass: internal cron-driven calls (e.g., agent-task-drainer,
    // agent-autopilot-worker) authenticate as service-role and pass `user_id` in body.
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (serviceRoleKey && token === serviceRoleKey) {
      let bodyUserId: string | null = null;
      try {
        const cloned = req.clone();
        const parsed = await cloned.json();
        if (parsed && typeof parsed === "object" && typeof parsed.user_id === "string") {
          bodyUserId = parsed.user_id;
        }
      } catch (_) {
        // body not JSON or empty
      }
      if (!bodyUserId) {
        return {
          auth: null as unknown as AuthContext,
          error: new Response(
            JSON.stringify({ error: "service-role calls require user_id in body" }),
            { status: 400, headers: { ...dynCors, "Content-Type": "application/json" } },
          ),
        };
      }
      // Build a service-role client (full access) for downstream operations.
      const svcClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        serviceRoleKey,
        { auth: { persistSession: false } },
      );
      return {
        auth: { userId: bodyUserId, authHeader, authClient: svcClient },
      };
    }

    const { data: { user: tokenUser }, error: tokenError } = await authClient.auth.getUser(token);
    if (tokenError || !tokenUser) {
      return {
        auth: null as unknown as AuthContext,
        error: new Response(JSON.stringify({ error: "Non autenticato" }), {
          status: 401,
          headers: { ...dynCors, "Content-Type": "application/json" },
        }),
      };
    }
    userId = tokenUser.id;
  } else {
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return {
        auth: null as unknown as AuthContext,
        error: new Response(JSON.stringify({ error: "Non autenticato" }), {
          status: 401,
          headers: { ...dynCors, "Content-Type": "application/json" },
        }),
      };
    }
    userId = user.id;
  }

  return {
    auth: { userId, authHeader, authClient },
  };
}

/**
 * Validate that agent_id exists and belongs to user
 */
export async function validateAgent(
  supabase: ReturnType<typeof createClient>,
  agentId: string,
  userId: string,
  dynCors: Record<string, string>
): Promise<{ agent: Record<string, unknown> | null; error?: Response }> {
  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .eq("user_id", userId)
    .single();

  if (agentErr || !agent) {
    return {
      agent: null,
      error: new Response(JSON.stringify({ error: "Agente non trovato" }), {
        status: 404,
        headers: { ...dynCors, "Content-Type": "application/json" },
      }),
    };
  }

  return { agent };
}

/**
 * Validate required body parameters
 */
export function validateRequestBody(
  body: Record<string, unknown>,
  required: string[],
  dynCors: Record<string, string>
): Response | null {
  for (const param of required) {
    if (!(param in body)) {
      return new Response(JSON.stringify({ error: `${param} richiesto` }), {
        status: 400,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
  }
  return null;
}

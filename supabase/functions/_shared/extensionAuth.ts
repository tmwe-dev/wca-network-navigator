/**
 * extensionAuth.ts — Auth guard for extension-called functions.
 *
 * Accepted auth methods (in order of preference):
 * 1. User JWT in `Authorization: Bearer <token>`  → returns the real user id.
 * 2. Service-role key in header `x-extension-key`  → requires `body.user_id`.
 *    Used by internal cron / triggers / wca-app bridge.
 * 3. (LEGACY) `Authorization: Bearer <SUPABASE_ANON_KEY>` → returns
 *    `userId = "extension-anon"`. Will be rejected when env
 *    `EXTENSION_AUTH_STRICT=true`. Kept ON by default to avoid breaking
 *    in-the-wild extensions; flip to true once all extensions ship JWT.
 *
 * Returns a Response (401/400) on failure.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ExtensionAuthResult {
  userId: string;
  authMethod: "jwt" | "anon-key" | "service";
}

export async function requireExtensionAuth(
  req: Request,
  corsHeaders: Record<string, string>,
  opts?: { bodyUserId?: string | null },
): Promise<ExtensionAuthResult | Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const strict = (Deno.env.get("EXTENSION_AUTH_STRICT") ?? "false").toLowerCase() === "true";

  // Path 2: service-role via dedicated header (internal callers only)
  const extKey = req.headers.get("x-extension-key");
  if (extKey && serviceKey && extKey === serviceKey) {
    const uid = opts?.bodyUserId;
    if (!uid || typeof uid !== "string") {
      return new Response(
        JSON.stringify({ success: false, message: "user_id required for service-role calls" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return { userId: uid, authMethod: "service" };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ success: false, message: "Authorization required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const token = authHeader.replace("Bearer ", "");

  // Path 3 (LEGACY): anon key fallback. Rejected in strict mode.
  if (token === anonKey) {
    if (strict) {
      return new Response(
        JSON.stringify({ success: false, message: "Anon-key auth disabled (EXT_ANON_REJECTED)" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    console.warn("extensionAuth: legacy anon-key auth from origin:", req.headers.get("origin"));
    return { userId: "extension-anon", authMethod: "anon-key" };
  }

  // Path 1: real user JWT
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await authClient.auth.getUser(token);

  if (error || !user) {
    return new Response(
      JSON.stringify({ success: false, message: "Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return { userId: user.id, authMethod: "jwt" };
}

export function isExtensionAuthError(result: ExtensionAuthResult | Response): result is Response {
  return result instanceof Response;
}

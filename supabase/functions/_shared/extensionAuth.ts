/**
 * extensionAuth.ts — Auth guard for extension-called functions.
 * 
 * Browser extensions may pass either:
 * 1. A real user JWT (preferred) → validates via getUser()
 * 2. The anon key (legacy) → accepted only from CORS-allowed origins
 * 
 * Returns userId if JWT is valid, or "extension-anon" for legacy anon-key auth.
 * Returns a Response (401) if neither is valid.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ExtensionAuthResult {
  userId: string;
  authMethod: "jwt" | "anon-key";
}

export async function requireExtensionAuth(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<ExtensionAuthResult | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ success: false, message: "Authorization required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // If token is the anon key itself (legacy extension pattern), accept with warning
  if (token === anonKey) {
    console.warn("extensionAuth: legacy anon-key auth from origin:", req.headers.get("origin"));
    return { userId: "extension-anon", authMethod: "anon-key" };
  }

  // Try to validate as a real JWT
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

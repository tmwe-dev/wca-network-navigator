/**
 * authGuard.ts — Shared auth check for Edge Functions.
 * Extracts Bearer token, validates via getClaims, returns userId or error Response.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  userId: string;
  token: string;
}

/**
 * Validates the Authorization header and returns the authenticated user ID.
 * Returns a Response (401) if auth fails, or AuthResult on success.
 */
export async function requireAuth(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AuthResult | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "AUTH_REQUIRED", message: "Bearer token required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return new Response(
      JSON.stringify({ error: "AUTH_INVALID", message: "Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return { userId: claimsData.claims.sub as string, token };
}

/** Type guard: checks if requireAuth returned an error Response */
export function isAuthError(result: AuthResult | Response): result is Response {
  return result instanceof Response;
}

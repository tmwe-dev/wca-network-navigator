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
 * Error body format:
 *  - "verbose" (default, PRE-E2 behavior): { error: CODE, message: "..." }
 *  - "terse":   { error: CODE }
 * Aggiunto in E2 in modo strettamente additivo. Default e i 16 caller
 * esistenti restano byte-identici.
 */
export type AuthErrorFormat = "verbose" | "terse";

/**
 * Optional claims verifier for offline/deterministic testing.
 * Runtime default construisce un supabase auth client + getClaims(token)
 * (comportamento pre-E2 byte-identico).
 * NON usare in codice di produzione: parametro opzionale, non documentato per i caller.
 */
export type ClaimsVerifier = (
  token: string,
  authHeader: string,
) => Promise<{ sub: string | null; error: unknown | null }>;

export interface RequireAuthOptions {
  errorFormat?: AuthErrorFormat;
  /** Internal test seam. Default: verificatore runtime basato su supabase-js. */
  _claimsVerifier?: ClaimsVerifier;
}

async function defaultClaimsVerifier(
  token: string,
  authHeader: string,
): Promise<{ sub: string | null; error: unknown | null }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
  return {
    sub: (claimsData?.claims?.sub as string | undefined) ?? null,
    error: claimsError ?? null,
  };
}

/**
 * Validates the Authorization header and returns the authenticated user ID.
 * Returns a Response (401) if auth fails, or AuthResult on success.
 */
export async function requireAuth(
  req: Request,
  corsHeaders: Record<string, string>,
  options: RequireAuthOptions = {},
): Promise<AuthResult | Response> {
  const errorFormat: AuthErrorFormat = options.errorFormat ?? "verbose";
  const buildErrorBody = (code: "AUTH_REQUIRED" | "AUTH_INVALID", message: string): string =>
    errorFormat === "terse" ? JSON.stringify({ error: code }) : JSON.stringify({ error: code, message });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(buildErrorBody("AUTH_REQUIRED", "Bearer token required"), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const verifier = options._claimsVerifier ?? defaultClaimsVerifier;
  const { sub, error: claimsError } = await verifier(token, authHeader);
  if (claimsError || !sub) {
    return new Response(buildErrorBody("AUTH_INVALID", "Invalid or expired token"), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return { userId: sub, token };
}

/** Type guard: checks if requireAuth returned an error Response */
export function isAuthError(result: AuthResult | Response): result is Response {
  return result instanceof Response;
}

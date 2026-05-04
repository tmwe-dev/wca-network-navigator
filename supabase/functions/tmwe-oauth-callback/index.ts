/**
 * tmwe-oauth-callback — Endpoint pubblico chiamato da TMWE dopo login operatore.
 *
 * Scambia il `code` per access/refresh token, recupera il profilo utente
 * (per ottenere `tmwe_user_id`), e persiste il record in tmwe_user_tokens.
 * Risponde con un redirect 302 verso /v2/settings/connections.
 */
import { serviceClient } from "../_shared/tmweClient.ts";

function htmlRedirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "no-store",
    },
  });
}

function appOrigin(): string {
  return (
    Deno.env.get("TMWE_APP_REDIRECT_BASE") ??
    "https://id-preview--c57c2f66-1827-4bc4-9643-9b6951bf4e62.lovable.app"
  );
}

function back(status: "ok" | "error", reason?: string): Response {
  const u = new URL("/v2/settings/connections", appOrigin());
  u.searchParams.set("tmwe", status);
  if (reason) u.searchParams.set("reason", reason);
  return htmlRedirect(u.toString());
}

async function postForm(
  baseUrl: string,
  path: string,
  body: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`TMWE ${path} ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as Record<string, unknown>;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return back("error", "missing_params");

    const svc = serviceClient();

    // Verify and consume state
    const { data: stateRow } = await svc
      .from("tmwe_oauth_state")
      .select("user_id, expires_at")
      .eq("state", state)
      .maybeSingle();

    if (!stateRow) return back("error", "invalid_state");
    if (new Date(stateRow.expires_at as string).getTime() < Date.now()) {
      await svc.from("tmwe_oauth_state").delete().eq("state", state);
      return back("error", "expired_state");
    }
    await svc.from("tmwe_oauth_state").delete().eq("state", state);

    const userId = stateRow.user_id as string;
    const baseUrl = (Deno.env.get("TMWE_BASE_URL") ?? "https://sandbox.findair.net").replace(/\/+$/, "");

    // Exchange code -> tokens
    const tok = await postForm(baseUrl, "/erp/tmwe_json/exchange_code_for_jwt", {
      grant_type: "authorization_code",
      code,
      client_id: Deno.env.get("TMWE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("TMWE_OAUTH_CLIENT_SECRET")!,
      redirect_uri: Deno.env.get("TMWE_OAUTH_REDIRECT_URI")!,
    });

    const accessToken = tok.access_token as string;
    const refreshToken = (tok.refresh_token as string) ?? null;
    const expiresIn = (tok.expires_in as number) ?? 3600;
    const scopeStr = (tok.scope as string) ?? "";

    // Fetch profile to get tmwe_user_id
    const profRes = await fetch(`${baseUrl}/erp/tmwe_json/get_my_profile`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    const profText = await profRes.text();
    if (!profRes.ok) return back("error", "profile_fetch_failed");
    const profile = JSON.parse(profText) as Record<string, unknown>;

    const tmweUserId =
      (profile.id as number) ??
      (profile.user_id as number) ??
      (profile.tmwe_user_id as number);
    if (!tmweUserId) return back("error", "no_tmwe_user_id");

    // Guard: same TMWE account already linked to a different user
    const { data: clash } = await svc
      .from("tmwe_user_tokens")
      .select("user_id")
      .eq("tmwe_user_id", tmweUserId)
      .maybeSingle();
    if (clash && (clash.user_id as string) !== userId) {
      return back("error", "tmwe_account_already_linked");
    }

    const upsert = {
      user_id: userId,
      tmwe_user_id: tmweUserId,
      tmwe_email: (profile.email as string) ?? null,
      tmwe_company: (profile.company as string) ?? (profile.company_name as string) ?? null,
      tmwe_vat_number:
        (profile.vat_number as string) ?? (profile.piva as string) ?? null,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      scopes: scopeStr ? scopeStr.split(/\s+/) : [],
      connected_at: new Date().toISOString(),
    };

    const { error: upErr } = await svc
      .from("tmwe_user_tokens")
      .upsert(upsert, { onConflict: "user_id" });
    if (upErr) return back("error", "persist_failed");

    return back("ok");
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "unknown";
    return back("error", reason.slice(0, 80));
  }
});
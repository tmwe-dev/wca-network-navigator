/**
 * tmwe-oauth-callback — Endpoint pubblico chiamato da TMWE dopo login operatore.
 *
 * Scambia il `code` per access/refresh token, recupera il profilo utente
 * (per ottenere `tmwe_user_id`), e persiste il record in tmwe_user_tokens.
 * Risponde con un redirect 302 verso /v2/settings/connections.
 */
import { serviceClient } from "../_shared/tmweClient.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function back(status: "ok" | "error", reason?: string, intent: "connect" | "login" = "connect"): Response {
  const path = intent === "login" ? "/v2/login" : "/v2/settings/connections";
  const u = new URL(path, appOrigin());
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
      .select("user_id, expires_at, intent")
      .eq("state", state)
      .maybeSingle();

    if (!stateRow) return back("error", "invalid_state");
    const intent = ((stateRow.intent as string) ?? "connect") as "connect" | "login";
    if (new Date(stateRow.expires_at as string).getTime() < Date.now()) {
      await svc.from("tmwe_oauth_state").delete().eq("state", state);
      return back("error", "expired_state", intent);
    }
    await svc.from("tmwe_oauth_state").delete().eq("state", state);

    let userId = stateRow.user_id as string | null;
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
    if (!profRes.ok) return back("error", "profile_fetch_failed", intent);
    const profile = JSON.parse(profText) as Record<string, unknown>;

    const tmweUserId =
      (profile.id as number) ??
      (profile.user_id as number) ??
      (profile.tmwe_user_id as number);
    if (!tmweUserId) return back("error", "no_tmwe_user_id", intent);
    const tmweEmail = (profile.email as string) ?? null;
    const tmweCompany = (profile.company as string) ?? (profile.company_name as string) ?? null;

    // ─── LOGIN INTENT: resolve or auto-create Lovable user ──────────────
    if (intent === "login") {
      if (!tmweEmail) return back("error", "no_tmwe_email", "login");

      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );

      // Try to find an existing connection by tmwe_user_id first
      const { data: existingConn } = await svc
        .from("tmwe_user_tokens")
        .select("user_id")
        .eq("tmwe_user_id", tmweUserId)
        .maybeSingle();

      if (existingConn?.user_id) {
        userId = existingConn.user_id as string;
      } else {
        // Look up auth user by email via listUsers (filter)
        let foundUserId: string | null = null;
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const match = list?.users?.find(
          (u) => (u.email ?? "").toLowerCase() === tmweEmail.toLowerCase(),
        );
        if (match) foundUserId = match.id;

        if (foundUserId) {
          userId = foundUserId;
        } else {
          // Auto-create
          const randomPwd = crypto.randomUUID() + crypto.randomUUID();
          const { data: created, error: createErr } = await admin.auth.admin.createUser({
            email: tmweEmail,
            email_confirm: true,
            password: randomPwd,
            user_metadata: {
              display_name: tmweCompany ?? tmweEmail.split("@")[0],
              created_via_tmwe: true,
            },
          });
          if (createErr || !created.user) {
            return back("error", "user_create_failed", "login");
          }
          userId = created.user.id;
          // Mark profile flag (best effort)
          await svc.from("profiles")
            .update({ created_via_tmwe: true })
            .eq("id", userId);
        }
      }
    }

    if (!userId) return back("error", "no_user_id", intent);

    // Guard: same TMWE account already linked to a different user
    const { data: clash } = await svc
      .from("tmwe_user_tokens")
      .select("user_id")
      .eq("tmwe_user_id", tmweUserId)
      .maybeSingle();
    if (clash && (clash.user_id as string) !== userId) {
      return back("error", "tmwe_account_already_linked", intent);
    }

    const upsert = {
      user_id: userId,
      tmwe_user_id: tmweUserId,
      tmwe_email: tmweEmail,
      tmwe_company: tmweCompany,
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
    if (upErr) return back("error", "persist_failed", intent);

    // ─── LOGIN: generate magic link and redirect there ──────────────────
    if (intent === "login" && tmweEmail) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: tmweEmail,
        options: { redirectTo: `${appOrigin()}/v2` },
      });
      if (linkErr || !linkData?.properties?.action_link) {
        return back("error", "magiclink_failed", "login");
      }
      return htmlRedirect(linkData.properties.action_link);
    }

    return back("ok", undefined, intent);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "unknown";
    return back("error", reason.slice(0, 80));
  }
});
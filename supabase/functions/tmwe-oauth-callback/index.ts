/**
 * tmwe-oauth-callback — Endpoint pubblico chiamato da TMWE dopo login operatore.
 *
 * Scambia il `code` per access/refresh token, recupera il profilo utente
 * (per ottenere `tmwe_user_id`), e persiste il record in tmwe_user_tokens.
 * Risponde con un redirect 302 verso /v2/settings/connections.
 */
import { serviceClient, tmweBaseUrl, tmweOAuthRedirectUri } from "../_shared/tmweClient.ts";
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

const DEFAULT_APP_ORIGIN =
  Deno.env.get("TMWE_APP_REDIRECT_BASE") ??
  "https://id-preview--c57c2f66-1827-4bc4-9643-9b6951bf4e62.lovable.app";

let runtimeAppOrigin: string = DEFAULT_APP_ORIGIN;
function appOrigin(): string {
  return runtimeAppOrigin || DEFAULT_APP_ORIGIN;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function stableNumericId(source: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash || 1;
}

function back(status: "ok" | "error", reason?: string, intent: "connect" | "login" = "connect"): Response {
  const path = intent === "login" ? "/v2/login" : "/v2/settings/connections";
  const u = new URL(path, appOrigin());
  u.searchParams.set("tmwe", status);
  if (reason) u.searchParams.set("reason", reason);
  console.log(JSON.stringify({
    type: "tmwe_oauth_callback_redirect",
    status,
    reason: reason ?? null,
    intent,
    location: u.toString(),
    ts: new Date().toISOString(),
  }));
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
  let currentIntent: "connect" | "login" = "connect";
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return back("error", "missing_params");

    const svc = serviceClient();

    // Verify and consume state
    const { data: stateRow } = await svc
      .from("tmwe_oauth_state")
      .select("user_id, expires_at, intent, app_origin")
      .eq("state", state)
      .maybeSingle();

    if (!stateRow) return back("error", "invalid_state");
    const intent = ((stateRow.intent as string) ?? "connect") as "connect" | "login";
    currentIntent = intent;
    const stateOrigin = (stateRow as { app_origin?: string | null }).app_origin;
    if (typeof stateOrigin === "string" && /^https?:\/\//i.test(stateOrigin)) {
      runtimeAppOrigin = stateOrigin.replace(/\/$/, "");
    }
    if (new Date(stateRow.expires_at as string).getTime() < Date.now()) {
      await svc.from("tmwe_oauth_state").delete().eq("state", state);
      return back("error", "expired_state", intent);
    }
    await svc.from("tmwe_oauth_state").delete().eq("state", state);

    let userId = stateRow.user_id as string | null;
    const baseUrl = tmweBaseUrl();

    // Exchange code -> tokens
    const tok = await postForm(baseUrl, "/erp/tmwe_json/token", {
      grant_type: "authorization_code",
      code,
      client_id: Deno.env.get("TMWE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("TMWE_OAUTH_CLIENT_SECRET")!,
      redirect_uri: tmweOAuthRedirectUri(),
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

    console.log("[tmwe-oauth-callback] profile keys:", Object.keys(profile));
    const nestedUser = (profile.user as Record<string, unknown> | undefined) ?? {};
    const nestedData = (profile.data as Record<string, unknown> | undefined) ?? {};
    const tmweUserIdentifier = firstString(
      profile.id,
      profile.user_id,
      profile.tmwe_user_id,
      profile.uid,
      profile.userId,
      profile.username,
      nestedUser.id,
      nestedUser.user_id,
      nestedUser.username,
      nestedData.id,
      nestedData.user_id,
      nestedData.username,
    );
    if (!tmweUserIdentifier) {
      console.error("[tmwe-oauth-callback] no_tmwe_user_id, profile=", JSON.stringify(profile).slice(0, 500));
      return back("error", "no_tmwe_user_id", intent);
    }
    const tmweUserId = /^\d+$/.test(tmweUserIdentifier)
      ? Number(tmweUserIdentifier)
      : stableNumericId(`tmwe:${tmweUserIdentifier.toLowerCase()}`);
    const tmweEmail = firstString(profile.email, nestedUser.email, nestedData.email);
    const tmweUsername = firstString(profile.username, nestedUser.username, nestedData.username);
    // Fallback domain MUST be @tmwe.it (the real operator domain that the
    // whitelist contains). Using @tmwe.local would block every operator whose
    // TMWE profile has email="" because the whitelist only has @tmwe.it.
    const TMWE_FALLBACK_DOMAIN = "tmwe.it";
    const authEmail = tmweEmail
      ?? (tmweUsername ? `${tmweUsername.toLowerCase()}@${TMWE_FALLBACK_DOMAIN}` : null);
    console.log(JSON.stringify({
      type: "tmwe_oauth_callback_email_resolution",
      tmweEmail,
      tmweUsername,
      authEmail,
      profile_top_keys: Object.keys(profile),
      nested_user_keys: Object.keys(nestedUser),
      nested_data_keys: Object.keys(nestedData),
      profile_sample: JSON.stringify(profile).slice(0, 800),
    }));
    const tmweCompany = firstString(
      profile.company,
      profile.company_name,
      profile.enterprise_name,
      nestedUser.company,
      nestedData.company,
    );

    // ─── LOGIN INTENT: resolve or auto-create Lovable user ──────────────
    if (intent === "login") {
      if (!authEmail) return back("error", "no_tmwe_email", "login");

      // ─── Whitelist gate (authorization) ─────────────────────────────
      // L'autenticazione è già fatta da TMWE. Qui controlliamo SOLO se
      // l'email autoritativa restituita da get_my_profile è presente in
      // `authorized_users` (is_active=true). Se no, blocco SENZA creare
      // l'utente Lovable né salvare token.
      const normalizedEmail = authEmail.trim().toLowerCase();
      // NOTA: TMWE può restituire email="" per account vecchi. In quel caso
      // ricadiamo su alias `<username>@tmwe.local` e lasciamo che sia la
      // whitelist `authorized_users` a decidere (l'admin può autorizzare
      // l'alias per username quando l'utente non ha email su TMWE).
      const { data: isAuthorized, error: wlErr } = await svc.rpc(
        "is_email_authorized",
        { p_email: normalizedEmail },
      );
      if (wlErr) {
        console.error("[tmwe-oauth-callback] whitelist check failed:", wlErr.message);
        return back("error", "whitelist_check_failed", "login");
      }
      if (!isAuthorized) {
        console.warn(JSON.stringify({
          type: "tmwe_oauth_callback_blocked",
          reason: "not_in_whitelist",
          normalizedEmail,
          tmweUsername,
        }));
        return back("error", "not_whitelisted", "login");
      }

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
          (u) => (u.email ?? "").toLowerCase() === authEmail.toLowerCase(),
        );
        if (match) foundUserId = match.id;

        if (foundUserId) {
          userId = foundUserId;
        } else {
          // Auto-create
          const randomPwd = crypto.randomUUID() + crypto.randomUUID();
          const { data: created, error: createErr } = await admin.auth.admin.createUser({
            email: authEmail,
            email_confirm: true,
            password: randomPwd,
            user_metadata: {
              display_name: firstString(profile.name, tmweCompany, tmweUsername, authEmail.split("@")[0]),
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

    // ─── Reconcile operators: bind operator row (matched by email) to this
    // auth user_id so admins keep their is_admin flag across re-logins.
    try {
      await svc
        .from("operators")
        .update({ user_id: userId, updated_at: new Date().toISOString() })
        .ilike("email", authEmail)
        .neq("user_id", userId);
    } catch (_e) { /* best effort */ }

    // ─── LOGIN: generate magic link and redirect there ──────────────────
    if (intent === "login" && authEmail) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: authEmail,
        options: { redirectTo: `${appOrigin()}/v2/auth-callback` },
      });
      if (linkErr || !linkData?.properties?.action_link) {
        return back("error", "magiclink_failed", "login");
      }
      return htmlRedirect(linkData.properties.action_link);
    }

    return back("ok", undefined, intent);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "unknown";
    console.error("[tmwe-oauth-callback]", reason);
    return back("error", reason.slice(0, 80), currentIntent);
  }
});
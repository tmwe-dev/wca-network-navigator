/**
 * tmweClient.ts — Shared helpers per integrazione TMWE (Findair sandbox).
 *
 * Centralizza:
 *  - lettura/refresh del token system (client_credentials)
 *  - lettura/refresh del token utente (Authorization Code + refresh_token)
 *  - whitelist delle operazioni esposte dal proxy
 *  - fetch verso TMWE con timeout AbortController
 *
 * I token TMWE non escono MAI dall'edge runtime: la UI riceve solo i dati
 * della risorsa richiesta più metadati di connessione.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface TmweOpDef {
  method: "GET" | "POST";
  path: string;
  identity: "user" | "system";
  scope: string;
}

/**
 * Whitelist deterministica delle operazioni esposte dal proxy.
 * Aggiungere una voce qui è l'unico modo per esporre nuovi endpoint TMWE.
 */
export const TMWE_OPS = {
  "profile.me": {
    method: "GET",
    path: "/erp/tmwe_json/get_my_profile",
    identity: "user",
    scope: "profile:read",
  },
  "tracking.byAwb": {
    method: "POST",
    path: "/erp/tmwe_json/shipment_tracking",
    identity: "user",
    scope: "tracking:read",
  },
  "shipment.list": {
    method: "GET",
    path: "/erp/tmwe_json/ext_my_shipments",
    identity: "user",
    scope: "shipment:read",
  },
  "shipment.unified": {
    method: "POST",
    path: "/erp/tmwe_json/unified_shipment",
    identity: "user",
    scope: "shipment:read",
  },
  "rubrica.search": {
    method: "POST",
    path: "/erp/tmwe_json/rubrica_search",
    identity: "user",
    scope: "profile:read",
  },
  "system.health": {
    method: "GET",
    path: "/erp/tmwe_json/health",
    identity: "system",
    scope: "admin",
  },
} as const satisfies Record<string, TmweOpDef>;

export type TmweOpName = keyof typeof TMWE_OPS;

const TOKEN_REFRESH_BUFFER_S = 60;
const FETCH_TIMEOUT_MS = 15_000;

function baseUrl(): string {
  const raw = (Deno.env.get("TMWE_BASE_URL") ?? "https://sandbox.findair.net").replace(/\/+$/, "");
  return raw.replace(/\/erp$/, "");
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

async function postForm(path: string, body: Record<string, string>): Promise<TokenResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`TMWE ${path} ${res.status}: ${text.slice(0, 300)}`);
    }
    return JSON.parse(text) as TokenResponse;
  } finally {
    clearTimeout(timer);
  }
}

function expiresAt(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function isFresh(expiresAtIso: string): boolean {
  return new Date(expiresAtIso).getTime() - Date.now() > TOKEN_REFRESH_BUFFER_S * 1000;
}

/* ----------------------------- SYSTEM TOKEN ------------------------------ */

export async function getSystemToken(svc: SupabaseClient): Promise<string> {
  const { data: row } = await svc
    .from("tmwe_system_tokens")
    .select("access_token, expires_at")
    .eq("id", true)
    .maybeSingle();

  if (row && isFresh(row.expires_at as string)) {
    return row.access_token as string;
  }

  const tok = await postForm("/erp/tmwe_json/token", {
    grant_type: "client_credentials",
    client_id: Deno.env.get("TMWE_SYSTEM_CLIENT_ID")!,
    client_secret: Deno.env.get("TMWE_SYSTEM_CLIENT_SECRET")!,
  });

  await svc.from("tmwe_system_tokens").upsert({
    id: true,
    access_token: tok.access_token,
    expires_at: expiresAt(tok.expires_in ?? 3600),
    scopes: tok.scope ? tok.scope.split(/\s+/) : [],
    updated_at: new Date().toISOString(),
  });

  return tok.access_token;
}

/* ------------------------------ USER TOKEN ------------------------------- */

export interface UserTokenRecord {
  user_id: string;
  tmwe_user_id: number;
  tmwe_email: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  scopes: string[];
}

export async function getUserToken(
  svc: SupabaseClient,
  userId: string,
): Promise<UserTokenRecord | null> {
  const { data } = await svc
    .from("tmwe_user_tokens")
    .select(
      "user_id, tmwe_user_id, tmwe_email, access_token, refresh_token, expires_at, scopes",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;
  let row = data as unknown as UserTokenRecord;

  if (!isFresh(row.expires_at)) {
    if (!row.refresh_token) return row; // miglior sforzo, lascia esplodere TMWE
    const refreshed = await postForm("/erp/tmwe_json/token", {
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
      client_id: Deno.env.get("TMWE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("TMWE_OAUTH_CLIENT_SECRET")!,
    });
    const updated = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? row.refresh_token,
      expires_at: expiresAt(refreshed.expires_in ?? 3600),
      scopes: refreshed.scope ? refreshed.scope.split(/\s+/) : row.scopes,
    };
    await svc.from("tmwe_user_tokens").update(updated).eq("user_id", userId);
    row = { ...row, ...updated };
  }

  return row;
}

/* --------------------------- PROXY FETCH HELPER -------------------------- */

export interface TmweCallResult {
  status: number;
  data: unknown;
  ok: boolean;
}

export async function callTmwe(
  op: TmweOpDef,
  bearer: string,
  params: Record<string, unknown> | undefined,
): Promise<TmweCallResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    let url = `${baseUrl()}${op.path}`;
    const init: RequestInit = {
      method: op.method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: "application/json",
      },
      signal: ctrl.signal,
    };
    if (op.method === "GET" && params) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      }
      const s = qs.toString();
      if (s) url += (url.includes("?") ? "&" : "?") + s;
    } else if (op.method === "POST") {
      (init.headers as Record<string, string>)["Content-Type"] = "application/json";
      init.body = JSON.stringify(params ?? {});
    }
    const res = await fetch(url, init);
    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // keep as text
    }
    return { status: res.status, data, ok: res.ok };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Helper per audit log non bloccante.
 */
export async function auditCall(
  svc: SupabaseClient,
  row: {
    user_id: string | null;
    tmwe_user_id: number | null;
    op: string;
    identity: string;
    status_code: number | null;
    latency_ms: number;
    error?: string | null;
  },
): Promise<void> {
  try {
    await svc.from("tmwe_proxy_audit").insert(row);
  } catch {
    // non-blocking
  }
}
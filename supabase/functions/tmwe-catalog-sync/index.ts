/**
 * tmwe-catalog-sync — sincronizza il catalogo dei 443 endpoint TMWE Findair
 * leggendo /client_api_docs con il system token e popolando `tmwe_api_catalog`.
 *
 * Trigger: chiamata manuale (admin) dalla pagina Schema Map o cron settimanale.
 * Output: { synced, inserted, updated, skipped, total }
 */
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import {
  serviceClient,
  getSystemToken,
  tmweBaseUrl,
} from "../_shared/tmweClient.ts";

type RiskLevel = "read" | "write" | "destructive" | "admin";

interface DocEndpoint {
  path: string;
  method: string;
  description?: string;
  summary?: string;
  group?: string;
  tags?: string[];
  scopes?: string[];
  parameters?: unknown[];
  responses?: Record<string, unknown>;
  identity?: "user" | "system";
}

function normMethod(m: string): string {
  return (m || "GET").toUpperCase();
}

function inferGroup(ep: DocEndpoint): string {
  if (ep.group) return ep.group;
  if (ep.tags && ep.tags.length) return ep.tags[0];
  // fallback: secondo segmento del path /erp/<group>/<action>
  const parts = ep.path.split("/").filter(Boolean);
  if (parts.length >= 2) return parts[1].replace(/^tmwe_json$/, "general");
  return "general";
}

function inferRisk(method: string, group: string, scopes: string[]): RiskLevel {
  const m = method.toUpperCase();
  const isAdminGroup = /admin|permission|role|user_management/i.test(group);
  const hasAdminScope = scopes.some((s) => /admin/i.test(s));
  if (isAdminGroup || hasAdminScope) return "admin";
  if (m === "DELETE") return "destructive";
  if (m === "GET") return "read";
  return "write"; // POST / PUT / PATCH
}

function deriveOpName(ep: DocEndpoint, group: string): string {
  // /erp/tmwe_json/get_my_profile  -> profile.api_get_my_profile
  const last = ep.path.split("/").filter(Boolean).pop() ?? "endpoint";
  return `${group}.${last}`.toLowerCase().replace(/[^a-z0-9_.]+/g, "_");
}

function defaultEnabled(risk: RiskLevel): boolean {
  return risk === "read" || risk === "write";
}

function defaultRequiresConfirmation(risk: RiskLevel): boolean {
  return risk === "write" || risk === "destructive";
}

function inferIdentity(ep: DocEndpoint, scopes: string[]): "user" | "system" {
  if (ep.identity) return ep.identity;
  if (scopes.some((s) => /admin|system|client_credentials/i.test(s))) return "system";
  return "user";
}

/**
 * I docs TMWE possono restituire formati diversi. Normalizziamo in DocEndpoint[].
 */
function flattenDocs(raw: unknown): DocEndpoint[] {
  const out: DocEndpoint[] = [];
  if (!raw || typeof raw !== "object") return out;

  // Caso 1: { endpoints: [...] }
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.endpoints)) {
    for (const e of r.endpoints as DocEndpoint[]) out.push(e);
    return out;
  }

  // Caso 2: OpenAPI-like { paths: { "/x": { get: {...}, post: {...} } } }
  if (r.paths && typeof r.paths === "object") {
    for (const [path, methods] of Object.entries(r.paths as Record<string, unknown>)) {
      if (!methods || typeof methods !== "object") continue;
      for (const [method, def] of Object.entries(methods as Record<string, unknown>)) {
        if (!["get", "post", "put", "patch", "delete"].includes(method.toLowerCase())) continue;
        const d = (def ?? {}) as Record<string, unknown>;
        out.push({
          path,
          method,
          description: (d.description as string) ?? (d.summary as string),
          summary: d.summary as string,
          tags: d.tags as string[],
          scopes: (d["x-scopes"] as string[]) ?? (d.scopes as string[]),
          parameters: d.parameters as unknown[],
          responses: d.responses as Record<string, unknown>,
        });
      }
    }
    return out;
  }

  // Caso 3: { groups: [{ name, endpoints: [...] }] }
  if (Array.isArray(r.groups)) {
    for (const g of r.groups as Array<Record<string, unknown>>) {
      const groupName = (g.name as string) ?? "general";
      const eps = (g.endpoints as DocEndpoint[]) ?? [];
      for (const e of eps) out.push({ ...e, group: e.group ?? groupName });
    }
    return out;
  }

  // Caso 4: array piatto a top level
  if (Array.isArray(raw)) {
    return raw as DocEndpoint[];
  }

  return out;
}

const ALIAS_MAP: Record<string, { path: string; method: string }> = {
  "profile.me": { path: "/erp/tmwe_json/get_my_profile", method: "GET" },
  "tracking.byAwb": { path: "/erp/tmwe_json/shipment_tracking", method: "POST" },
  "shipment.list": { path: "/erp/tmwe_json/ext_my_shipments", method: "GET" },
  "shipment.unified": { path: "/erp/tmwe_json/unified_shipment", method: "POST" },
  "rubrica.search": { path: "/erp/tmwe_json/rubrica_search", method: "POST" },
  "system.health": { path: "/erp/tmwe_json/health", method: "GET" },
};

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const corsH = getCorsHeaders(req.headers.get("origin"));
  const headers = getSecurityHeaders(corsH);

  try {
    const auth = await requireAuth(req, corsH);
    if (isAuthError(auth)) return auth;

    const svc = serviceClient();
    const token = await getSystemToken(svc);
    const url = `${tmweBaseUrl()}/client_api_docs`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const text = await res.text();
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "DOCS_FETCH_FAILED", status: res.status, body: text.slice(0, 400) }),
        { status: 502, headers },
      );
    }
    let docs: unknown;
    try { docs = JSON.parse(text); } catch {
      return new Response(JSON.stringify({ error: "DOCS_NOT_JSON" }), { status: 502, headers });
    }

    const eps = flattenDocs(docs);
    if (!eps.length) {
      return new Response(
        JSON.stringify({ error: "NO_ENDPOINTS_PARSED", raw_keys: Object.keys(docs as object ?? {}) }),
        { status: 502, headers },
      );
    }

    const rows = eps.map((ep) => {
      const method = normMethod(ep.method);
      const group = inferGroup(ep);
      const scopes = ep.scopes ?? [];
      const risk = inferRisk(method, group, scopes);
      const op = deriveOpName(ep, group);
      const identity = inferIdentity(ep, scopes);
      return {
        op,
        method,
        path: ep.path,
        description: ep.description ?? ep.summary ?? null,
        scopes,
        parameters: ep.parameters ?? [],
        responses: ep.responses ?? {},
        api_group: group,
        risk_level: risk,
        identity,
        enabled: defaultEnabled(risk),
        requires_confirmation: defaultRequiresConfirmation(risk),
        is_alias: false,
        alias_of: null as string | null,
        source: "sync",
        verified_at: new Date().toISOString(),
      };
    });

    // Aggiungi alias backward-compat (puntano alle entry "vere" già upsertate)
    for (const [aliasOp, def] of Object.entries(ALIAS_MAP)) {
      // trova target reale per path+method
      const target = rows.find((r) => r.path === def.path && r.method === def.method);
      rows.push({
        op: aliasOp,
        method: def.method,
        path: def.path,
        description: target?.description ?? `Alias backward-compat per ${def.path}`,
        scopes: target?.scopes ?? [],
        parameters: target?.parameters ?? [],
        responses: target?.responses ?? {},
        api_group: target?.api_group ?? aliasOp.split(".")[0],
        risk_level: target?.risk_level ?? "read",
        identity: target?.identity ?? "user",
        enabled: true,
        requires_confirmation: target?.requires_confirmation ?? false,
        is_alias: true,
        alias_of: target?.op ?? null,
        source: "alias",
        verified_at: new Date().toISOString(),
      });
    }

    // Upsert a batch (chunk per evitare payload enormi)
    const CHUNK = 200;
    let upserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await svc
        .from("tmwe_api_catalog")
        .upsert(slice, { onConflict: "op", ignoreDuplicates: false });
      if (error) {
        return new Response(
          JSON.stringify({ error: "UPSERT_FAILED", detail: error.message, at_index: i }),
          { status: 500, headers },
        );
      }
      upserted += slice.length;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total_endpoints: eps.length,
        upserted,
        aliases: Object.keys(ALIAS_MAP).length,
        groups: [...new Set(rows.map((r) => r.api_group))].length,
      }),
      { status: 200, headers },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers });
  }
});
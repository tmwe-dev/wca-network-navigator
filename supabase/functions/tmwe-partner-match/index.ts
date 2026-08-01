/**
 * tmwe-partner-match — Cerca candidati cliente TMWE per un partner Lovable.
 * Identity: user (OAuth operatore).
 * Strategia: 1) match esatto P.IVA, 2) lookup VIES, 3) fuzzy su denominazione.
 */
import { z } from "https://esm.sh/zod@3.23.8";
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import { TMWE_OPS, callTmwe, getUserToken, serviceClient } from "../_shared/tmweClient.ts";
import { logTmweAudit, notConnectedResponse } from "../_shared/tmweAudit.ts";

const InputSchema = z.object({
  partner_id: z.string().uuid(),
});

interface Candidate {
  tmwe_client_id: string;
  denomination: string | null;
  vat: string | null;
  city: string | null;
  score: number;
  reason: "exact_vat" | "vies" | "name_fuzzy";
}

function normalizeVat(v: string | null | undefined): string | null {
  if (!v) return null;
  return v.replace(/\s+/g, "").toUpperCase();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function extractRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["data", "rows", "results", "items", "records"]) {
      const v = obj[key];
      if (Array.isArray(v)) return v as Array<Record<string, unknown>>;
    }
  }
  return [];
}

function pick(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim()) return String(v);
  }
  return null;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const corsH = getCorsHeaders(req.headers.get("origin"));
  const headers = getSecurityHeaders(corsH);

  const auth = await requireAuth(req, corsH);
  if (isAuthError(auth)) return auth;

  const svc = serviceClient();
  const t0 = performance.now();

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }), {
        status: 400, headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    const { partner_id } = parsed.data;

    const { data: partner } = await svc.from("partners")
      .select("id, denomination, vat_number, city")
      .eq("id", partner_id).maybeSingle();

    if (!partner) {
      return new Response(JSON.stringify({ error: "PARTNER_NOT_FOUND" }), {
        status: 404, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const userTok = await getUserToken(svc, auth.userId);
    if (!userTok) return notConnectedResponse(headers);

    const candidates = new Map<string, Candidate>();
    const partnerVat = normalizeVat((partner as Record<string, unknown>).vat_number as string);
    const partnerName = ((partner as Record<string, unknown>).denomination as string | null) ?? "";
    const partnerCity = ((partner as Record<string, unknown>).city as string | null) ?? "";

    // 1) Match esatto P.IVA
    if (partnerVat) {
      const r = await callTmwe(TMWE_OPS["anagrafica.searchByVat"], userTok.access_token, { vat: partnerVat, limit: 10 });
      for (const row of extractRows(r.data)) {
        const id = pick(row, ["id", "client_id", "code", "codice"]);
        const v = normalizeVat(pick(row, ["vat", "vat_number", "piva", "partita_iva"]));
        if (!id) continue;
        candidates.set(id, {
          tmwe_client_id: id,
          denomination: pick(row, ["denomination", "denominazione", "name", "ragione_sociale"]),
          vat: v,
          city: pick(row, ["city", "citta", "comune"]),
          score: v && v === partnerVat ? 100 : 70,
          reason: v && v === partnerVat ? "exact_vat" : "name_fuzzy",
        });
      }
    }

    // 2) Fuzzy su denominazione (se nessun match esatto)
    if (candidates.size === 0 && partnerName) {
      const r = await callTmwe(TMWE_OPS["anagrafica.list"], userTok.access_token, { q: partnerName, limit: 20 });
      const target = partnerName.toLowerCase();
      for (const row of extractRows(r.data)) {
        const id = pick(row, ["id", "client_id", "code", "codice"]);
        if (!id) continue;
        const den = pick(row, ["denomination", "denominazione", "name", "ragione_sociale"]) ?? "";
        const dist = levenshtein(target, den.toLowerCase());
        const maxLen = Math.max(target.length, den.length, 1);
        const sim = Math.round(100 * (1 - dist / maxLen));
        if (sim < 60) continue;
        candidates.set(id, {
          tmwe_client_id: id,
          denomination: den || null,
          vat: normalizeVat(pick(row, ["vat", "vat_number", "piva"])),
          city: pick(row, ["city", "citta", "comune"]),
          score: sim,
          reason: "name_fuzzy",
        });
      }
    }

    const result = Array.from(candidates.values()).sort((a, b) => b.score - a.score).slice(0, 10);
    const latency = Math.round(performance.now() - t0);
    await logTmweAudit(svc, {
      op_name: "partner-match", identity: "user", caller_user_id: auth.userId,
      partner_id, status: 200, latency_ms: latency,
    });

    return new Response(JSON.stringify({ candidates: result, partner: { vat: partnerVat, denomination: partnerName, city: partnerCity } }), {
      status: 200, headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await logTmweAudit(svc, {
      op_name: "partner-match", identity: "user", caller_user_id: auth.userId,
      status: 500, latency_ms: Math.round(performance.now() - t0), error_message: message,
    });
    return new Response(JSON.stringify({ error: "INTERNAL", message }), {
      status: 500, headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
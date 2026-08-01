/**
 * tmwe-customer-sync — Aggiorna snapshot anagrafica + fatturato 12 mesi.
 * Modalità:
 *  - single: { mode:"single", tmwe_client_id } richiesto da UI/link, identity=user
 *  - batch:  { mode:"batch", limit?:50 } richiesto da cron (header x-cron-secret), identity=system
 */
import { z } from "https://esm.sh/zod@3.23.8";
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import {
  TMWE_OPS, callTmwe, getUserToken, getSystemToken, serviceClient,
} from "../_shared/tmweClient.ts";
import { logTmweAudit, notConnectedResponse } from "../_shared/tmweAudit.ts";

const InputSchema = z.union([
  z.object({ mode: z.literal("single"), tmwe_client_id: z.string().min(1) }),
  z.object({ mode: z.literal("batch"), limit: z.number().int().min(1).max(200).optional() }),
]);

function pick(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim()) return String(v);
  }
  return null;
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

function startOfYearAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

async function syncOne(svc: ReturnType<typeof serviceClient>, token: string, tmweClientId: string) {
  // 1) Anagrafica
  const ana = await callTmwe(TMWE_OPS["anagrafica.byId"], token, { id: tmweClientId });
  const anaRow = extractRows(ana.data)[0] ?? (ana.data as Record<string, unknown> | null) ?? {};

  // 2) Listino assegnato
  const ass = await callTmwe(TMWE_OPS["listini.assignments"], token, { client_id: tmweClientId, limit: 1 });
  const assRow = extractRows(ass.data)[0] ?? {};

  await svc.from("tmwe_customer_snapshot").upsert({
    tmwe_client_id: tmweClientId,
    denomination: pick(anaRow as Record<string, unknown>, ["denomination", "denominazione", "name", "ragione_sociale"]),
    vat: pick(anaRow as Record<string, unknown>, ["vat", "vat_number", "piva", "partita_iva"]),
    is_active: ((): boolean => {
      const v = (anaRow as Record<string, unknown>)["is_active"] ?? (anaRow as Record<string, unknown>)["attivo"] ?? (anaRow as Record<string, unknown>)["active"];
      if (v === false || v === 0 || v === "0" || v === "false") return false;
      return true;
    })(),
    assigned_price_list_id: pick(assRow as Record<string, unknown>, ["price_list_id", "listino_id", "id"]),
    assigned_price_list_name: pick(assRow as Record<string, unknown>, ["price_list_name", "listino", "name"]),
    raw_payload: { ana: anaRow, assignment: assRow },
    last_synced_at: new Date().toISOString(),
  }, { onConflict: "tmwe_client_id" });

  // 3) Fatture ultimi 12 mesi
  const inv = await callTmwe(TMWE_OPS["invoices.byClient"], token, {
    client_id: tmweClientId,
    date_from: startOfYearAgo(),
    limit: 500,
  });
  const invoices = extractRows(inv.data);

  // Aggrega per anno/mese
  const buckets = new Map<string, { revenue: number; count: number; services: Record<string, number> }>();
  for (const r of invoices) {
    const dateStr = pick(r, ["date", "data", "issue_date", "data_emissione"]);
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) continue;
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    const key = `${y}-${m}`;
    const amount = Number(pick(r, ["total", "amount", "totale", "imponibile"]) ?? 0);
    const svcType = (pick(r, ["service_type", "servizio", "type"]) ?? "other").toLowerCase();
    const b = buckets.get(key) ?? { revenue: 0, count: 0, services: {} };
    b.revenue += isFinite(amount) ? amount : 0;
    b.count += 1;
    b.services[svcType] = (b.services[svcType] ?? 0) + 1;
    buckets.set(key, b);
  }
  if (buckets.size) {
    const rows = Array.from(buckets.entries()).map(([k, v]) => {
      const [y, m] = k.split("-").map(Number);
      return {
        tmwe_client_id: tmweClientId, year: y, month: m,
        revenue_amount: Math.round(v.revenue * 100) / 100,
        currency: "EUR", invoices_count: v.count,
        services_breakdown: v.services, updated_at: new Date().toISOString(),
      };
    });
    await svc.from("tmwe_revenue_monthly").upsert(rows, { onConflict: "tmwe_client_id,year,month" });
  }
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const corsH = getCorsHeaders(req.headers.get("origin"));
  const headers = getSecurityHeaders(corsH);

  const svc = serviceClient();
  const t0 = performance.now();

  try {
    const parsed = InputSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }), {
        status: 400, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Cron mode: x-cron-secret obbligatorio per batch.
    const cronSecret = req.headers.get("x-cron-secret");
    const isCron = parsed.data.mode === "batch" && cronSecret && cronSecret === Deno.env.get("CRON_SECRET");

    let identity: "user" | "system";
    let token: string;
    let callerUserId: string | null = null;

    if (isCron) {
      identity = "system";
      token = await getSystemToken(svc);
    } else {
      const auth = await requireAuth(req, corsH);
      if (isAuthError(auth)) return auth;
      callerUserId = auth.userId;
      const userTok = await getUserToken(svc, auth.userId);
      if (!userTok) return notConnectedResponse(headers);
      token = userTok.access_token;
      identity = "user";
    }

    const errors: Array<{ id: string; error: string }> = [];
    let synced = 0;

    if (parsed.data.mode === "single") {
      try {
        await syncOne(svc, token, parsed.data.tmwe_client_id);
        synced = 1;
      } catch (e) {
        errors.push({ id: parsed.data.tmwe_client_id, error: e instanceof Error ? e.message : "unknown" });
      }
    } else {
      const limit = parsed.data.limit ?? 50;
      // Prendi i client linkati da più tempo non sincronizzati (LRU)
      const { data: links } = await svc.from("tmwe_partner_links")
        .select("tmwe_client_id, tmwe_customer_snapshot:tmwe_customer_snapshot(last_synced_at)")
        .limit(limit);
      const ids = (links ?? [])
        .map((r) => (r as { tmwe_client_id: string }).tmwe_client_id)
        .filter(Boolean);
      for (const id of ids) {
        try {
          await syncOne(svc, token, id);
          synced += 1;
        } catch (e) {
          errors.push({ id, error: e instanceof Error ? e.message : "unknown" });
        }
      }
    }

    await logTmweAudit(svc, {
      op_name: "customer-sync", identity, caller_user_id: callerUserId,
      status: 200, latency_ms: Math.round(performance.now() - t0),
      error_message: errors.length ? `partial: ${errors.length} failed` : null,
    });

    return new Response(JSON.stringify({ ok: true, synced, errors }), {
      status: 200, headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await logTmweAudit(svc, { op_name: "customer-sync", identity: "system", caller_user_id: null, status: 500, latency_ms: Math.round(performance.now() - t0), error_message: message });
    return new Response(JSON.stringify({ error: "INTERNAL", message }), {
      status: 500, headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
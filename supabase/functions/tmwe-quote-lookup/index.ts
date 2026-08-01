/**
 * tmwe-quote-lookup — Calcola tariffa per un partner usando il listino TMWE assegnato.
 */
import { z } from "https://esm.sh/zod@3.23.8";
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import { TMWE_OPS, callTmwe, getUserToken, serviceClient } from "../_shared/tmweClient.ts";
import { logTmweAudit, notConnectedResponse } from "../_shared/tmweAudit.ts";

const InputSchema = z.object({
  partner_id: z.string().uuid(),
  origin: z.string().min(2),
  destination: z.string().min(2),
  weight_kg: z.number().positive(),
  service_type: z.string().optional(),
});

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
    const parsed = InputSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }), {
        status: 400, headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    const { partner_id, origin, destination, weight_kg, service_type } = parsed.data;

    const { data: link } = await svc.from("tmwe_partner_links")
      .select("tmwe_client_id").eq("partner_id", partner_id).maybeSingle();
    if (!link) {
      return new Response(JSON.stringify({ error: "PARTNER_NOT_LINKED", message: "Collega prima il partner a un cliente TMWE." }), {
        status: 409, headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    const tmweClientId = (link as { tmwe_client_id: string }).tmwe_client_id;

    const userTok = await getUserToken(svc, auth.userId);
    if (!userTok) return notConnectedResponse(headers);

    const { data: snap } = await svc.from("tmwe_customer_snapshot")
      .select("assigned_price_list_id").eq("tmwe_client_id", tmweClientId).maybeSingle();
    const priceListId = (snap as { assigned_price_list_id: string | null } | null)?.assigned_price_list_id ?? null;

    const r = await callTmwe(TMWE_OPS["listini.rateLookup"], userTok.access_token, {
      client_id: tmweClientId,
      price_list_id: priceListId ?? undefined,
      origin, destination, weight: weight_kg,
      service_type: service_type ?? undefined,
    });

    await logTmweAudit(svc, {
      op_name: "quote-lookup", identity: "user", caller_user_id: auth.userId,
      partner_id, status: r.ok ? 200 : r.status, latency_ms: Math.round(performance.now() - t0),
      error_message: r.ok ? null : `tmwe ${r.status}`,
    });

    return new Response(JSON.stringify({ ok: r.ok, price_list_id: priceListId, quote: r.data }), {
      status: r.ok ? 200 : 502, headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await logTmweAudit(svc, { op_name: "quote-lookup", identity: "user", caller_user_id: auth.userId, status: 500, latency_ms: Math.round(performance.now() - t0), error_message: message });
    return new Response(JSON.stringify({ error: "INTERNAL", message }), {
      status: 500, headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
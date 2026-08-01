/**
 * tmwe-partner-link — Crea il collegamento partner ⇄ cliente TMWE
 * e triggera la sync del singolo cliente.
 */
import { z } from "https://esm.sh/zod@3.23.8";
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import { serviceClient } from "../_shared/tmweClient.ts";
import { logTmweAudit } from "../_shared/tmweAudit.ts";

const InputSchema = z.object({
  partner_id: z.string().uuid(),
  tmwe_client_id: z.string().min(1),
  tmwe_vat: z.string().nullable().optional(),
  match_confidence: z.enum(["exact_vat", "vies", "manual", "name_fuzzy"]),
  // azione: "link" (default) | "unlink"
  action: z.enum(["link", "unlink"]).optional(),
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
    const { partner_id, tmwe_client_id, tmwe_vat, match_confidence, action } = parsed.data;

    if (action === "unlink") {
      const { error } = await svc.from("tmwe_partner_links")
        .delete().eq("partner_id", partner_id);
      if (error) throw error;
      await logTmweAudit(svc, { op_name: "partner-unlink", identity: "user", caller_user_id: auth.userId, partner_id, status: 200, latency_ms: Math.round(performance.now() - t0) });
      return new Response(JSON.stringify({ ok: true, unlinked: true }), {
        status: 200, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await svc.from("tmwe_partner_links")
      .upsert({
        partner_id, tmwe_client_id, tmwe_vat: tmwe_vat ?? null,
        match_confidence, linked_by_user_id: auth.userId, linked_at: new Date().toISOString(),
      }, { onConflict: "partner_id" })
      .select().maybeSingle();
    if (error) throw error;

    // Trigger fire-and-forget sync per quel singolo cliente.
    const syncUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tmwe-customer-sync`;
    fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: req.headers.get("Authorization") ?? "",
      },
      body: JSON.stringify({ mode: "single", tmwe_client_id }),
    }).catch(() => { /* non-blocking */ });

    await logTmweAudit(svc, { op_name: "partner-link", identity: "user", caller_user_id: auth.userId, partner_id, status: 200, latency_ms: Math.round(performance.now() - t0) });

    return new Response(JSON.stringify({ ok: true, link: data }), {
      status: 200, headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await logTmweAudit(svc, { op_name: "partner-link", identity: "user", caller_user_id: auth.userId, status: 500, latency_ms: Math.round(performance.now() - t0), error_message: message });
    return new Response(JSON.stringify({ error: "INTERNAL", message }), {
      status: 500, headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
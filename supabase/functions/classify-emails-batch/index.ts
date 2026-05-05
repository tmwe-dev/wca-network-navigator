/**
 * classify-emails-batch — esegue la classificazione retroattiva su un set
 * di `channel_messages` già presenti in DB.
 *
 * Per ogni message_id richiama internamente `classify-inbound-message` (che
 * a sua volta innesca `classify-inbound-content` e popola
 * `email_classifications`). Esegue in serie con piccolo delay per non
 * superare i rate-limit AI. Risposta sincrona con counters.
 *
 * Body: { message_ids?: string[]; limit?: number; only_unclassified?: boolean }
 * - se `message_ids` è omesso prende le ultime N inbound non classificate.
 */
import "../_shared/llmFetchInterceptor.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface BatchBody {
  message_ids?: string[];
  limit?: number;
  only_unclassified?: boolean;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  const sec = getSecurityHeaders();
  if (req.method === "OPTIONS") return corsPreflight(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...cors, ...sec, "Content-Type": "application/json" },
    });
  }

  // Auth: usa il JWT dell'utente per RLS
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing auth" }), {
      status: 401, headers: { ...cors, ...sec, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, ...sec, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  let body: BatchBody = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  // Risolvi la lista dei message_ids
  let ids: string[] = Array.isArray(body.message_ids) ? body.message_ids.filter(Boolean) : [];
  const cap = Math.min(Math.max(body.limit ?? 50, 1), 200);

  if (ids.length === 0) {
    let q = admin.from("channel_messages")
      .select("id, from_address")
      .eq("user_id", user.id)
      .eq("direction", "inbound")
      .eq("channel", "email")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(cap);

    if (body.only_unclassified !== false) {
      // prendi solo quelli senza riga in email_classifications collegata
      const { data: rows } = await q;
      const candidateIds = (rows ?? []).map((r) => r.id as string);
      if (candidateIds.length === 0) {
        return new Response(JSON.stringify({ ok: true, total: 0, processed: 0, errors: 0 }), {
          headers: { ...cors, ...sec, "Content-Type": "application/json" },
        });
      }
      const { data: alreadyClassified } = await admin
        .from("email_classifications")
        .select("source_activity_id")
        .in("source_activity_id", candidateIds);
      const done = new Set((alreadyClassified ?? []).map((r) => r.source_activity_id));
      ids = candidateIds.filter((id) => !done.has(id));
    } else {
      const { data: rows } = await q;
      ids = (rows ?? []).map((r) => r.id as string);
    }
  }

  ids = ids.slice(0, cap);

  let processed = 0;
  let errors = 0;
  const errorDetail: Array<{ id: string; error: string }> = [];

  for (const id of ids) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/classify-inbound-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ message_id: id, force: true }),
      });
      if (!res.ok) {
        errors++;
        errorDetail.push({ id, error: `HTTP ${res.status}` });
      } else {
        processed++;
      }
    } catch (e) {
      errors++;
      errorDetail.push({ id, error: e instanceof Error ? e.message : String(e) });
    }
    // Rate-limit guard
    await new Promise((r) => setTimeout(r, 150));
  }

  return new Response(JSON.stringify({
    ok: true,
    total: ids.length,
    processed,
    errors,
    error_detail: errorDetail.slice(0, 20),
  }), {
    headers: { ...cors, ...sec, "Content-Type": "application/json" },
  });
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { setDynCors, jsonResponse } from "./response.ts";
import {
  handleVerify,
  handleTest,
  handleFetch,
  handleSendEmail,
} from "./handlers.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  setDynCors(getCorsHeaders(origin));

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "AUTH_REQUIRED" }, 401);
  }

  try {
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return jsonResponse({ error: "AUTH_INVALID" }, 401);
    }
  } catch {
    return jsonResponse({ error: "AUTH_INVALID" }, 401);
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    const body = req.method === "POST" ? await req.json() : {};

    switch (path) {
      case "verify":
        return await handleVerify(body);
      case "test":
        return await handleTest(body);
      case "fetch":
        return await handleFetch(body);
      case "send":
        return await handleSendEmail(body);
      default:
        return jsonResponse({ error: "Endpoint non trovato" }, 404);
    }
  } catch (err: unknown) {
    console.error("[email-imap-proxy] Error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Errore interno" },
      500
    );
  }
});

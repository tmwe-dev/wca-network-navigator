import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { setDynCors, jsonResponse } from "./response.ts";
import { resolveMailbox } from "../_shared/resolveMailbox.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import { handleVerify, handleTest, handleFetch, handleSendEmail } from "./handlers.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  setDynCors(getCorsHeaders(origin));

  // Auth check — contratto invariato: { error: "AUTH_REQUIRED" | "AUTH_INVALID" }, 401.
  // Il fallback legacy su eccezione (getClaims che lancia) resta AUTH_INVALID.
  try {
    const auth = await requireAuth(req, getCorsHeaders(origin), { errorFormat: "terse" });
    if (isAuthError(auth)) {
      const body = await auth.json();
      return jsonResponse(body, 401);
    }
  } catch {
    return jsonResponse({ error: "AUTH_INVALID" }, 401);
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    const body = req.method === "POST" ? await req.json() : {};

    // Step D — opt-in shared mailbox: se x-mailbox-id è presente,
    // sovrascriviamo lato server le credenziali IMAP/SMTP nel body con
    // quelle risolte (env dedicati). Senza header → flusso legacy invariato.
    const mailboxIdHeader = req.headers.get("x-mailbox-id");
    const mailboxId = mailboxIdHeader && mailboxIdHeader.trim() !== "" ? mailboxIdHeader.trim() : null;
    if (mailboxId && (path === "test" || path === "fetch" || path === "send")) {
      const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const resolved = await resolveMailbox(serviceClient, mailboxId);
      if (path === "send") {
        body.email = resolved.smtp_user;
        body.password = resolved.smtp_password;
        body.smtpHost = resolved.smtp_host;
        body.smtpPort = resolved.smtp_port;
      } else {
        body.email = resolved.imap_user;
        body.password = resolved.imap_password;
        body.host = resolved.imap_host;
        body.port = resolved.imap_port;
        body.tls = true;
      }
    }

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
    return jsonResponse({ error: err instanceof Error ? err.message : "Errore interno" }, 500);
  }
});

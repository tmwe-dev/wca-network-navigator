import { ImapClient } from "jsr:@workingdevshero/deno-imap";
import { getCaCertsForHost } from "./caCerts.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { edgeError, extractErrorMessage } from "../_shared/handleEdgeError.ts";
import { requireInternalOrUser } from "../_shared/internalAuth.ts";



type DebugGlobal = typeof globalThis & { __lastDebug?: Record<string, unknown> };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireInternalOrUser(req, null, corsHeaders);
  if (auth.kind === "error") return auth.response;
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const which = (body.mailbox as string) || "booking";
    const useSmtpPwd = !!body.use_smtp_pwd;
    const hostOverride = (body.host as string) || "";
    const user = which === "booking" ? "booking@tmwe.it" : Deno.env.get("IMAP_USER") || "luca@tmwe.it";
    const pass =
      which === "booking"
        ? useSmtpPwd
          ? Deno.env.get("SMTP_PASSWORD_BOOKING") || ""
          : Deno.env.get("IMAP_PASSWORD_BOOKING") || ""
        : Deno.env.get("IMAP_PASSWORD") || "";
    const passLen = pass.length;
    const passHead = pass.slice(0, 2);
    const passTail = pass.slice(-2);
    const host = hostOverride || (which === "booking" ? "mx01.vmteca.net" : "imaps.aruba.it");
    const debug = {
      user,
      hasPass: !!pass,
      passLen,
      passHead,
      passTail,
      secretUsed:
        which === "booking" ? (useSmtpPwd ? "SMTP_PASSWORD_BOOKING" : "IMAP_PASSWORD_BOOKING") : "IMAP_PASSWORD",
      host,
    };
    if (!pass) {
      return edgeError("INTERNAL_ERROR", "no_password", undefined, corsHeaders, { debug });
    }
    (globalThis as DebugGlobal).__lastDebug = debug;

    const client = new ImapClient({
      host: debug.host,
      port: 993,
      tls: true,
      username: user,
      password: pass,
      autoReconnect: false,
      maxReconnectAttempts: 0,
      connectionTimeout: 15000,
      tlsOptions: { caCerts: getCaCertsForHost(debug.host) },
    } as unknown as ConstructorParameters<typeof ImapClient>[0]);
    await client.connect();
    await client.authenticate();
    const list = await client.listMailboxes();
    try {
      await client.disconnect();
    } catch {
      /* ignore */
    }
    const folders = list;
    return new Response(JSON.stringify({ user, folders }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const dbg = (globalThis as DebugGlobal).__lastDebug || null;
    return edgeError("INTERNAL_ERROR", extractErrorMessage(err), undefined, corsHeaders, {
      debug: dbg,
    });
  }
});

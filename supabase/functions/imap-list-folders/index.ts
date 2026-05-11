import { ImapClient } from "jsr:@workingdevshero/deno-imap";
import { getCaCertsForHost } from "./caCerts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const which = (body.mailbox as string) || "booking";
    const useSmtpPwd = !!body.use_smtp_pwd;
    const hostOverride = (body.host as string) || "";
    const user = which === "booking" ? "booking@tmwe.it" : (Deno.env.get("IMAP_USER") || "luca@tmwe.it");
    const pass = which === "booking"
      ? (useSmtpPwd
          ? (Deno.env.get("SMTP_PASSWORD_BOOKING") || "")
          : (Deno.env.get("IMAP_PASSWORD_BOOKING") || ""))
      : (Deno.env.get("IMAP_PASSWORD") || "");
    const passLen = pass.length;
    const passHead = pass.slice(0, 2);
    const passTail = pass.slice(-2);
    const host = hostOverride || (which === "booking" ? "mx01.vmteca.net" : "imaps.aruba.it");
    const debug = { user, hasPass: !!pass, passLen, passHead, passTail, secretUsed: which === "booking" ? (useSmtpPwd ? "SMTP_PASSWORD_BOOKING" : "IMAP_PASSWORD_BOOKING") : "IMAP_PASSWORD", host };
    if (!pass) return new Response(JSON.stringify({ error: "no_password", debug }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    (globalThis as any).__lastDebug = debug;

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
    } as any);
    await client.connect();
    await client.authenticate();
    const list = await client.listMailboxes();
    try { await client.disconnect(); } catch (_) { /* ignore */ }
    const folders = list;
    return new Response(JSON.stringify({ user, folders }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const dbg = (globalThis as any).__lastDebug || null;
    return new Response(JSON.stringify({ error: String(err?.message || err), debug: dbg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
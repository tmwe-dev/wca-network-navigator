import { ImapClient } from "jsr:@workingdevshero/deno-imap";
import { getCaCertsForHost } from "./caCerts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = Deno.env.get("IMAP_USER") || "booking@tmwe.it";
    const pass = Deno.env.get("IMAP_PASSWORD");
    const debug = { user, hasPass: !!pass, host: Deno.env.get("IMAP_HOST") || "imaps.aruba.it" };
    if (!pass) return new Response(JSON.stringify({ error: "no_password", debug }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
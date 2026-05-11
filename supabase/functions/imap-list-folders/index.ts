import { ImapFlow } from "npm:imapflow@1.0.166";

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

    const client = new ImapFlow({
      host: debug.host,
      port: 993,
      secure: true,
      auth: { user, pass },
      logger: false,
    });
    try {
      await client.connect();
    } catch (e) {
      return new Response(JSON.stringify({ error: "connect_failed", message: String(e?.message || e), debug }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const list = await client.list();
    await client.logout();
    const folders = list.map((f) => ({
      path: f.path,
      name: f.name,
      delimiter: f.delimiter,
      flags: Array.from(f.flags || []),
      specialUse: f.specialUse,
      subscribed: f.subscribed,
    }));
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
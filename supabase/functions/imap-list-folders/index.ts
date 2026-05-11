import { ImapFlow } from "npm:imapflow@1.0.166";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const mailbox = (body.mailbox as string) || "booking";
    const passEnv = mailbox === "booking" ? "IMAP_PASSWORD_BOOKING" : "IMAP_PASSWORD";
    const userEnv = mailbox === "booking" ? "booking@tmwe.it" : Deno.env.get("IMAP_USER")!;
    const pass = Deno.env.get(passEnv) || Deno.env.get("IMAP_PASSWORD");
    if (!pass) return new Response(JSON.stringify({ error: "no_password" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const client = new ImapFlow({
      host: "imaps.aruba.it",
      port: 993,
      secure: true,
      auth: { user: userEnv, pass },
      logger: false,
    });
    await client.connect();
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
    return new Response(JSON.stringify({ user: userEnv, folders }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});